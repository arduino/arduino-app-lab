import { trimFileExtension } from '@cloud-editor-mono/common';
import {
  ChangeEvent,
  Key,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  AddFileHandler,
  DeleteFileHandler,
  MakeUniqueFileName,
  NewTabMenuItemIds,
  OnBeforeFileAction,
  RenameFileHandler,
  SelectableFileData,
  SUPPORTED_IMAGE_TYPES,
  SUPPORTED_TYPES,
  TabMenuItemIds,
} from '../EditorTabsBar.type';

type UseTabsBar = (
  tabs: SelectableFileData[],
  selectedTab: SelectableFileData | undefined,
  mainFile: SelectableFileData | undefined,
  inputRef: React.RefObject<HTMLInputElement>,
  selectTab: (id?: string) => void,
  selectSecretsTab: () => void,
  closeTab: (id: string) => void,
  addFile: AddFileHandler,
  renameFile: RenameFileHandler,
  deleteFile: DeleteFileHandler,
  makeUniqueFileName: MakeUniqueFileName,
  replaceFileNameInvalidCharacters: (fileName: string) => string,
  onBeforeFileAction?: OnBeforeFileAction,
) => {
  filePath?: string;
  newTabMenuAction: (key: Key) => void;
  tabAction: (key: Key, fileId: string) => void;
  addNewTab: (fileName: string, fileExtension: string) => void;
  renameTab: (fileId: string, newFileName: string) => void;
  handleImportedFile: (e: ChangeEvent<HTMLInputElement>) => Promise<void>;
  onTabClick: (
    tab: SelectableFileData,
    event?: React.MouseEvent<HTMLButtonElement, MouseEvent>,
  ) => void;
  isNewTabAdded: boolean;
  newTabActionType?: NewTabMenuItemIds;
  renamingFileId?: string;
};

export const useTabsBar: UseTabsBar = function (
  tabs,
  selectedTab,
  mainFile,
  inputRef,
  selectTab,
  selectSecretsTab,
  closeTab,
  addFile,
  renameFile,
  deleteFile,
  makeUniqueFileName,
  replaceFileNameInvalidCharacters,
  onBeforeFileAction,
): ReturnType<UseTabsBar> {
  const [isNewTabAdded, setIsNewTabAdded] = useState(false);
  const [newTabActionType, setNewTabActionType] = useState<NewTabMenuItemIds>();
  // Triggers rename flow for rename file action and on file import complete
  const [renamingFileId, setRenamingFileId] = useState<string | undefined>(
    undefined,
  );
  // Bypass rename flow if user selects different file during import
  const bypassRenameAfterImport = useRef<
    { bypass: boolean; fileId?: string } | undefined
  >(undefined);

  const filePath =
    mainFile?.fileId !== undefined && mainFile?.fileFullName !== undefined
      ? mainFile?.fileId.replace(mainFile?.fileFullName, '')
      : undefined;

  useEffect(() => {
    if (
      bypassRenameAfterImport.current &&
      bypassRenameAfterImport.current.fileId !== selectedTab?.fileId
    ) {
      bypassRenameAfterImport.current = { bypass: true };
    }
  }, [selectedTab?.fileId]);

  const newTabMenuAction = (key: Key): void => {
    const onActionResult =
      onBeforeFileAction && onBeforeFileAction(key as NewTabMenuItemIds);
    if (onActionResult?.bypassDefault) return;

    setNewTabActionType(key as NewTabMenuItemIds);

    switch (key) {
      case NewTabMenuItemIds.AddSecretsTab: {
        selectSecretsTab();
        break;
      }
      case NewTabMenuItemIds.ImportFile: {
        inputRef.current && inputRef.current.click();
        break;
      }
      case NewTabMenuItemIds.AddHeaderFile:
      case NewTabMenuItemIds.AddSketchFile:
      case NewTabMenuItemIds.AddTextFile: {
        selectTab(undefined);
        setIsNewTabAdded(true);
      }
    }
  };

  const tabAction = (key: Key, fileId: string): void => {
    const onActionResult =
      key !== TabMenuItemIds.Close &&
      onBeforeFileAction &&
      onBeforeFileAction(key as TabMenuItemIds);
    if (onActionResult && onActionResult?.bypassDefault) return;

    switch (key) {
      case TabMenuItemIds.Close:
        closeTab(fileId);
        break;
      case TabMenuItemIds.DeleteFile:
        deleteFile(fileId);
        break;
      case TabMenuItemIds.RenameFile: {
        setRenamingFileId(fileId);
        break;
      }
    }
  };

  const addNewTab = useCallback(
    (fileName: string, fileExtension: string): void => {
      const fileId = `${filePath}${fileName}.${fileExtension}`;
      addFile(fileId, fileName, fileExtension);
      setIsNewTabAdded(false);
    },
    [addFile, filePath],
  );

  const renameTab = useCallback(
    (filedId: string, newFileName: string): void => {
      const tab = tabs.find((tab) => tab.fileId === filedId);
      if (tab && tab.fileName !== newFileName) {
        renameFile(filedId, newFileName);
      }
      setRenamingFileId(undefined);
    },
    [renameFile, tabs],
  );

  const importFile = useCallback(
    async (file: File, code: string): Promise<void> => {
      const validFileName = replaceFileNameInvalidCharacters(
        file.name && trimFileExtension(file.name),
      );
      const fileExtension = getFileExtFromFile(file);
      const fileName = makeUniqueFileName(validFileName, fileExtension);

      const fileId = `${filePath}${fileName}${
        fileExtension ? `.${fileExtension}` : ''
      }`;

      bypassRenameAfterImport.current = { fileId, bypass: false };
      // `await` for file to be created before triggering rename flow
      await addFile(fileId, fileName, fileExtension, code);

      if (!bypassRenameAfterImport.current?.bypass) {
        setRenamingFileId(fileId);
      }
      bypassRenameAfterImport.current = undefined;

      if (inputRef.current) {
        inputRef.current.value = '';
      }
    },
    [
      replaceFileNameInvalidCharacters,
      makeUniqueFileName,
      filePath,
      addFile,
      inputRef,
    ],
  );

  // TODO: add support for multiple files
  const handleImportedFile = async (
    e: ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    if (e.target.files) {
      const importedFile = e.target.files[0];

      const fileExtension = getFileExtFromFile(importedFile);
      if (!fileExtension || !SUPPORTED_TYPES.includes(`.${fileExtension}`)) {
        console.error('File type not supported');
        return;
      }

      if (SUPPORTED_IMAGE_TYPES.includes(`.${fileExtension}`)) {
        const reader = new FileReader();
        reader.onloadend = function (): void {
          const result = reader.result as string;
          importFile(importedFile, result.split(',')[1]);
        };
        reader.readAsDataURL(importedFile);
        return;
      }

      const text = await importedFile.text();
      importFile(importedFile, text);
    }
  };

  const onTabClick = useCallback(
    (
      tab: SelectableFileData,
      event?: React.MouseEvent<HTMLButtonElement, MouseEvent>,
    ): void => {
      if (event && event.button === 2 && !tab.isMetadataReadOnly) {
        event.preventDefault();
        const onActionResult =
          onBeforeFileAction && onBeforeFileAction(TabMenuItemIds.RenameFile);
        if (onActionResult?.bypassDefault) {
          return;
        }
        setRenamingFileId(tab.fileId);
        return;
      }

      selectTab(tab.fileId);
    },
    [onBeforeFileAction, selectTab],
  );

  return {
    filePath,
    newTabMenuAction,
    tabAction,
    addNewTab,
    renameTab,
    handleImportedFile,
    onTabClick,
    isNewTabAdded,
    newTabActionType,
    renamingFileId,
  };
};

function getFileExtFromFile(file: File): string {
  const fileNameParts = file.name.split('.');

  return fileNameParts && fileNameParts.length > 1
    ? `${fileNameParts.pop() || ''}`
    : '';
}
