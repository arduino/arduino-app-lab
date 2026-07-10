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
  Icon?: React.ReactNode;
  isFixed?: boolean;
  isMetadataReadOnly?: boolean;
  isPreview?: boolean;
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
  selectTab: (params: {
    fileId?: string;
    openAtIndex?: number;
    isPreview?: boolean;
  }) => void;
  selectSecretsTab: () => void;
  closeTab: (id: string) => void;
  previewFileId?: string;
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
  showFileSearch?: boolean;
  /**
   * Opens the given file in the split (right) pane, or pushes it to the
   * existing split pane if one is already open. When undefined, the
   * "Split Right" entry is hidden from the tab context menu (used by the
   * right pane to suppress the action on its own tabs).
   */
  onSplitRight?: (fileId: string) => void;
  /**
   * Re-selects the given file in the left pane. When undefined, the
   * "Split Left" entry is hidden from the tab context menu (used by the
   * left pane to suppress the action on its own tabs).
   */
  onSplitLeft?: (fileId: string) => void;
  /**
   * Optional override for the "Close All" menu action. When provided it
   * replaces the default behaviour (iterating `closeTab` over `tabs`),
   * so consumers can perform atomic batch operations such as folding the
   * right pane back into the left when collapsing the split.
   */
  onCloseAll?: () => void;
  /**
   * Commits a tab dropped onto this bar from the OTHER pane's bar: moves
   * `fileId` out of its origin pane and inserts it at `insertIndex` in
   * this pane's tab list. When undefined the bar does not accept
   * cross-pane tab drops.
   */
  onCrossPaneDrop?: (fileId: string, insertIndex: number) => void;
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
  CloseOthers = 'CloseOthers',
  CloseToTheLeft = 'CloseToTheLeft',
  CloseToTheRight = 'CloseToTheRight',
  CloseAll = 'CloseAll',
  SplitRight = 'SplitRight',
  SplitLeft = 'SplitLeft',
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

export const SUPPORTED_IMAGE_TYPES = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.svg',
  '.bmp',
  '.ico',
  '.avif',
  '.apng',
];

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
