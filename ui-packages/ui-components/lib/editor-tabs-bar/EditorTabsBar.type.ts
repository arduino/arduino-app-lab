import { FunctionComponent, Key, SVGProps } from 'react';
import { MessageDescriptor } from 'react-intl';

import {
  DropdownMenuItemType,
  DropdownMenuSectionType,
} from '../essential/dropdown-menu';

export interface SelectableFileData {
  fileId: string;
  fileFullName: string;
  fileName: string;
  fileExtension: string;
  tags: string[];
  Icon?: FunctionComponent<
    SVGProps<SVGSVGElement> & { title?: string | undefined }
  >;
  isFixed?: boolean;
  isMetadataReadOnly?: boolean;
}

export type AddFileHandler = (
  fileId: string,
  fileName: string,
  fileExtension: string,
  code?: string,
) => Promise<void>;

export type RenameFileHandler = (
  fileId: string,
  newName: string,
) => Promise<void>;

export type DeleteFileHandler = (fileId: string) => Promise<void>;

export type ValidateFileName = (
  prevName: string,
  newName: string,
  extension: string,
) => FileNameValidationResult;

export type MakeUniqueFileName = (
  fileName: string,
  extension: string,
) => string;

export type OnBeforeFileAction = (key: NewTabMenuItemIds | TabMenuItemIds) => {
  bypassDefault: boolean;
};

export type TabsBarLogic = () => {
  tabs: SelectableFileData[];
  selectableMainFile?: SelectableFileData;
  selectedTab?: SelectableFileData;
  selectTab: (id?: string) => void;
  selectSecretsTab: () => void;
  closeTab: (id: string) => void;
  updateTabOrder: (ids: string[]) => void;
  sketchDataIsLoading?: boolean;
  unsavedFileIds?: UnsavedFileIds;
  onBeforeFileAction?: (key: NewTabMenuItemIds | TabMenuItemIds) => {
    bypassDefault: boolean;
  };
  validateFileName: ValidateFileName;
  makeUniqueFileName: MakeUniqueFileName;
  addFile: AddFileHandler;
  renameFile: RenameFileHandler;
  deleteFile: DeleteFileHandler;
  replaceFileNameInvalidCharacters: (fileName: string) => string;
  getFileIcon: (
    fileName: string,
  ) =>
    | FunctionComponent<
        SVGProps<SVGSVGElement> & { title?: string | undefined }
      >
    | undefined;
  isExampleSketchRoute: boolean;
  hasSetHeightOnHover: boolean;
  isReadOnly: boolean;
  dispatchNewFileAction?: Key | null;
  setDispatchNewFileAction?: (key: Key | null) => void;
  isRenderedMarkdownFile?: boolean;
};

export enum FileExtension {
  AddSketchFile = 'ino',
  AddHeaderFile = 'h',
  AddTextFile = 'txt',
}

export enum FileNameValidation {
  exceedsLimit = 'exceedsLimit',
  alreadyExists = 'alreadyExists',
  hasInvalidCharacters = 'hasInvalidCharacters',
  emptyName = 'emptyName',
}

export type FileNameValidationItem = {
  id: FileNameValidation;
  message: string;
  type?: 'error' | 'warning';
};

export type FileNameValidationResult = Array<FileNameValidationItem>;

export type TabMenuItemType = DropdownMenuItemType<
  TabMenuItemIds | NewTabMenuItemIds,
  MessageDescriptor
>;

export type TabMenuSection = DropdownMenuSectionType<
  TabMenuItemIds | NewTabMenuItemIds,
  MessageDescriptor
>;

export enum TabMenuItemIds {
  Close = 'Close',
  RenameFile = 'RenameFile',
  DeleteFile = 'DeleteFile',
}

export enum NewTabMenuItemIds {
  AddSketchFile = 'AddSketchFile',
  AddHeaderFile = 'AddHeaderFile',
  AddTextFile = 'AddTextFile',
  AddSecretsTab = 'AddSecretsTab',
  ImportFile = 'ImportFile',
}

export type TabMenuDictionary<T> = { [K in TabMenuItemIds]: T };
export type TabMenuItemDictionary = TabMenuDictionary<TabMenuItemType>;

export type NewTabMenuDictionary<T> = { [K in NewTabMenuItemIds]: T };
export type NewTabMenuItemDictionary = NewTabMenuDictionary<TabMenuItemType>;

export type UnsavedFileIds = Set<string>;

export const SUPPORTED_IMAGE_TYPES = ['.jpg', '.png', '.svg'];

export const SUPPORTED_TYPES = [
  ...SUPPORTED_IMAGE_TYPES,
  '.ino',
  '.cpp',
  '.c',
  '.h',
  '.txt',
  '.adoc',
  '.md',
  '.asciidoc',
  '.asc',
  '.pde',
];
