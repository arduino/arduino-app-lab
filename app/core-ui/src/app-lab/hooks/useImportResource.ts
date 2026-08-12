import {
  eventsEmit,
  importDroppedResourceToApp,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { BOARD_STORAGE_FULL_ERROR } from '@cloud-editor-mono/infrastructure';
import {
  checkForDuplicates,
  importResourceDialogMessages,
  ImportResourceLogic,
  ImportStatus,
  snackbar,
  useI18n,
  UseImportResourceProps,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

const createSuccessfulImportMessage = (resourceName: string): string =>
  resourceName
    ? `${resourceName} correctly imported`
    : `Files uploaded successfully.`;

export const useImportResource = (
  props: UseImportResourceProps,
): ImportResourceLogic => {
  const {
    importResourceDialogOpen,
    setImportResourceDialogOpen,
    setImportedResourceId,
    selectResourcePath,
    importResourceFromPath,
    type,
    invalidateQueries,
    nodes = [],
    targetFolderPath = '',
    onDuplicateConflict,
  } = props;

  const { formatMessage } = useI18n();

  const [importStatus, setImportStatus] = useState<ImportStatus>(
    ImportStatus.Idle,
  );
  const [importErrorMessage, setImportErrorMessage] = useState<
    string | undefined
  >();

  const cancelCurrentImport = useCallback(() => {
    eventsEmit('import-cancel');

    snackbar({
      message: 'Upload files interrupted by user',
      variant: 'info',
    });

    setImportStatus(ImportStatus.Idle);
  }, []);

  const closeDialog = useCallback(() => {
    setImportStatus(ImportStatus.Idle);
    setImportErrorMessage(undefined);
    setImportResourceDialogOpen(false);
  }, [setImportResourceDialogOpen, setImportStatus, setImportErrorMessage]);

  const { mutateAsync: handleImportFromPath } = useMutation({
    mutationFn: async (data: {
      filePath: string;
      isFolder: boolean;
      newFileName?: string;
    }) => {
      setImportStatus(ImportStatus.Uploading);
      setImportErrorMessage(undefined);
      return importResourceFromPath(
        data.filePath,
        data.isFolder,
        data.newFileName,
      );
    },
    onSuccess: (result) => {
      setImportedResourceId(result.id);
      invalidateQueries();

      snackbar({
        message: createSuccessfulImportMessage(result.name),
        variant: 'success',
      });
    },
    onError: (error: unknown) => {
      const message =
        typeof error === 'string'
          ? error
          : error && typeof error === 'object' && 'message' in error
          ? (error as Error).message
          : 'Unknown error occurred';

      if (message.includes('import-cancelled')) {
        invalidateQueries();
        return;
      }

      setImportStatus(ImportStatus.UploadFailed);
      setImportErrorMessage(
        message.includes(BOARD_STORAGE_FULL_ERROR)
          ? formatMessage(
              importResourceDialogMessages.uploadFailedStorageFullApp,
            )
          : message,
      );
    },
  });

  const processImportPath = useCallback(
    async (path: string, isFolder: boolean) => {
      const fileName = path.split(/[/\\]/).pop() || '';
      const targetPath = targetFolderPath
        ? `${targetFolderPath}/${fileName}`
        : fileName;

      const actualType = isFolder ? 'folder' : 'file';
      if (nodes.length > 0 && onDuplicateConflict) {
        const { hasDuplicate, conflictType } = checkForDuplicates(
          nodes,
          targetPath,
          actualType,
        );
        if (hasDuplicate) {
          onDuplicateConflict({
            fileName,
            sourcePath: path,
            targetPath,
            conflictType,
            isExternalImport: true,
          });

          return;
        }
      }
      await handleImportFromPath({ filePath: path, isFolder });
    },
    [nodes, targetFolderPath, onDuplicateConflict, handleImportFromPath],
  );

  useEffect(() => {
    const unsubscribe = importDroppedResourceToApp(
      async (items: { path: string; isFolder: boolean }[]) => {
        if (items && items.length > 0) {
          setImportResourceDialogOpen(true);
          try {
            for (const { path, isFolder } of items) {
              await processImportPath(path, isFolder);
            }

            closeDialog();
          } catch (error) {
            console.error(error);
          }
        }
      },
    );

    return () => {
      unsubscribe();
    };
  }, [processImportPath, closeDialog, setImportResourceDialogOpen]);

  const startImport = useCallback(async () => {
    if (!selectResourcePath) return;

    const selectedResult = await selectResourcePath();
    if (!selectedResult || selectedResult.length === 0) return;

    const pathsToProcess = Array.isArray(selectedResult)
      ? selectedResult
      : [selectedResult];

    try {
      for (const path of pathsToProcess) {
        await processImportPath(path, type === 'folder');
      }

      closeDialog();
    } catch (error) {
      console.error(error);
    }
  }, [selectResourcePath, closeDialog, processImportPath]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        setImportStatus(ImportStatus.Idle);
        setImportErrorMessage(undefined);
        setImportedResourceId(undefined);
      }
      if (!open) {
        if (importStatus === ImportStatus.Uploading) {
          cancelCurrentImport();
        }
        setImportStatus(ImportStatus.Idle);
        setImportErrorMessage(undefined);
        setImportedResourceId(undefined);
      }
      setImportResourceDialogOpen(open);
    },
    [
      setImportResourceDialogOpen,
      setImportedResourceId,
      importStatus,
      cancelCurrentImport,
    ],
  );

  return () => ({
    open: importResourceDialogOpen,
    status: importStatus,
    errorMessage: importErrorMessage,
    onOpenChange: handleOpenChange,
    startImport,
    type,
  });
};
