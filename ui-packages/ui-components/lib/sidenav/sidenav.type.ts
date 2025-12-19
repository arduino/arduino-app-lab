import { ThreadMessage } from '@assistant-ui/react';
import {
  CodeIcon,
  TechReference,
} from '@cloud-editor-mono/images/assets/icons';
import {
  ArduinoBuilderExampleFile_BuilderApi,
  AssistantContent_GenAiApi,
  GetBoards_Response,
  GetCustomLibrary_Response,
  GetFavoriteLibraries_Response,
  GetFile_ResponseWithContents,
  GetFile_ResponseWithName,
  GetFilesList_Response,
  GetLibraries_Params,
  GetLibraries_Response,
  GetLibrariesList_Response,
  GetLibrary_Params,
  HumanContent_GenAiApi,
  LibrariesItem_Response,
  LibraryDetails_Response,
  Libs_CreateApi,
  RetrievedDocument,
  RetrievedDocumentType,
  SketchData,
  TransmissionTag,
} from '@cloud-editor-mono/infrastructure';
import { PressEvent } from '@react-aria/interactions';
import { PressEvents } from '@react-types/shared';
import {
  FetchNextPageOptions,
  InfiniteQueryObserverResult,
  QueryKey,
} from '@tanstack/react-query';
import { Key } from 'react';
import { FunctionComponent, SVGProps } from 'react';
import { MessageDescriptor } from 'react-intl';

import {
  DeleteFileHandler,
  FileNameValidationResult,
  RenameFileHandler,
  SelectableFileData,
} from '../editor-tabs-bar';
import {
  DropdownMenuItemType,
  DropdownMenuSectionType,
} from '../essential/dropdown-menu';
import { GenAiBannerLogic } from '../gen-ai-banner';
import {
  CategoryTree,
  ReferenceEntry,
  ReferenceItem,
  ReferencePath,
  ReferenceSearchResult,
} from './sections/reference/reference.type';
import {
  Preferences,
  PreferenceValue,
} from './sections/settings/settings.type';

export type SidenavStandardLibrary = LibrariesItem_Response;
export type SidenavCustomLibrary = GetCustomLibrary_Response;

export type DependentSidenavLogic = () => {
  handleLibraryInclude: OnClickInclude;
  handleGenAiApplyCode: OnClickApplySketch;
  handleGenAiApplyFixToCode: OnClickApplyFixToSketch;
  handleApplyPatchAvailability: ApplyPatchAvailability;
  isExampleSketchRoute: boolean;
  exampleIsFromLibrary?: boolean;
  exampleIsFromCustomLibrary?: boolean;
  pinnedLibraries?: SketchData['libraries'];
  canModifySketchMetadata?: boolean;
  examplesMenuHandlers: ExamplesMenuHandlerDictionary;
  libraryMenuHandlers: LibraryMenuHandlerDictionary;
  selectedBoard?: string;
  boardName?: string;
  selectedArchitecture?: string;
  enableGetCustomLibraries: boolean;
  saveAllFiles: () => void;
  handleOptOut?: () => void;
  onLibraryUpload: () => void;
  isUploadingLibrary: boolean;
  bypassOrgHeader: boolean;
  onPrivateResourceRequestError?: (error: unknown) => void;
  explorerFiles: SelectableFileData[];
  unsavedFileIds: Set<string> | undefined;
  selectedFile?: SelectableFileData;
  selectFile: (fileId?: string) => void;
  renameFile: RenameFileHandler;
  deleteFile: DeleteFileHandler;
  newFileAction: (key: Key | null) => void;
  isLoadingFiles: boolean;
  validateFileName: (
    prevName: string,
    newName: string,
    extension: string,
  ) => FileNameValidationResult;
  replaceFileNameInvalidCharacters: (fileName: string) => string;
  isReadOnly: boolean;
  genAiBannerLogic: GenAiBannerLogic;
  scrollToLine: (line: number, fileName?: string) => void;
  errorLines?: number[];
  isErrorExplanationSending: boolean;
  isErrorExplanationStreamSending: boolean;
  stopErrorExplanationGeneration: () => void;
  errorFiles?: string[];
  isAiRestrictionsEnabled?: boolean;
  openGenAIPolicyTermsDialog: () => void;
  hydrateByPaths: (paths: string[]) => Promise<void>;
};

export enum SidenavItemId {
  Files = 'Files',
  Examples = 'Examples',
  Libraries = 'Libraries',
  Reference = 'Reference',
  GenAI = 'GenAI',
  Settings = 'Settings',
}

export type SidenavItemRecord = Record<SidenavItemId, SidenavItem>;

export type UseSidenavLogic = () => {
  topSidenavItems: SidenavItemWithId[];
  bottomSidenavItems: SidenavItemWithId[];
  sidenavSharedLogic: UseSidenavSharedLogic;
  contentLogicMap: ContentLogicMap;
  headerLogicMap: HeaderLogicMap;
  onInteract?: PressEvents['onPress'];
  activeItem?: SidenavItemWithId;
  sectionKey?: string; // A CHANGE IN KEY WILL "RESET" SIDENAV SECTION COMPONENT //TODO move this inside `contentLogicMap` to keep `UseSidenavLogic` more generic
  disabledItems?: SidenavItemId[];
  initialSidenavWidth?: number;
  onSizeChange?: (width: number) => void;
  isGenAiBannerDismissed: boolean;
  sketchExplorerHasBeenOpened: boolean;
};

export interface ContentLogicMap {
  [SidenavItemId.Files]: UseFilesLogic;
  [SidenavItemId.Examples]: UseExamplesLogic;
  [SidenavItemId.Libraries]: UseLibrariesLogic;
  [SidenavItemId.Reference]: UseReferenceLogic;
  [SidenavItemId.GenAI]: UseGenAILogic;
  [SidenavItemId.Settings]: UseSettingsLogic;
}

export interface HeaderLogicMap {
  [SidenavItemId.Files]: () => null;
  [SidenavItemId.Examples]: () => null;
  [SidenavItemId.Libraries]: () => {
    onLibraryUpload: () => void;
    isUploadingLibrary: boolean;
  };
  [SidenavItemId.GenAI]: () => null;
  [SidenavItemId.Reference]: () => null;
  [SidenavItemId.Settings]: () => null;
}

export interface SidenavItem {
  label: MessageDescriptor;
  labelDetails?: MessageDescriptor;
  Icon: React.FC;
  active?: boolean;
  position?: 'top' | 'bottom';
}

export type SidenavItemWithId = SidenavItem & { id: SidenavItemId };

export type OnClickInclude = (
  code: string,
  meta?: { name: string; version?: string },
) => void;

export type OnClickApplySketch = (code: string) => void;
export type OnClickApplyFixToSketch = (
  fileName: string,
  code?: string,
  lineToScroll?: number,
) => void;
export type ApplyPatchAvailability = (
  fileName: string,
  diff: string,
) => string | false;

export type UseSidenavSharedLogic = () => {
  getLibraries: GetLibraries;
  getLibrary: GetLibrary;
  getCustomLibrary: GetCustomLibrary;
  isExampleSketchContext: () => boolean;
  getExampleLinkSearch: GetExampleLinkSearch;
  onExampleLinkInteract: PressEvents['onPress'];
  getCurrentResourceIds: () => {
    exampleID?: string;
    sourceLibraryID?: string;
    customLibraryID?: string;
  };
  exampleLinkToPath: string;
  examplesMenuHandlers: ExamplesMenuHandlerDictionary;
  getExampleFileContents: GetExampleFileContents;
  getExamplesByFolder: (examples: Example[]) => ExamplesFolder[];
  getCustomLibraryExamplesByFolder: (
    examples: GetFilesList_Response,
  ) => CustomLibraryExampleItem[];
  bypassOrgHeader: boolean;
  onPrivateResourceRequestError?: (error: unknown) => void;
  clearChatConfirm: () => void;
  clearChat: () => void;
  restoreChat: () => void;
  isConversationEmpty: boolean;
  isClearChatNotificationOpen: boolean;
  showMoreInfoLinks: boolean;
  history: GenAIConversation;
  sendMessage: (text: string, tag?: TransmissionTag) => void;
  isLoading: boolean;
  isSending: boolean;
  triggerSurvey: (
    event: PressEvent,
    type: SurveyType,
    chatHistory: string,
  ) => void;
  stopGeneration: () => void;
  sketchPlanAction: (sketchPlanPayload: {
    promptMessageId?: string;
    assistantMessageTs?: string;
    actionType: SketchPlanActionType;
  }) => void;
  sketchPlanActionIsLoading: boolean;
  isSketchPlan: boolean;
  isStreamSending: boolean;
  actionType?: SketchPlanActionType;
  onCopyCode?: (code: string) => void;
  acceptLegalDisclaimer: () => void;
  isLegalDisclaimerAccepted: boolean;
};

export type UseLibrariesLogic = () => {
  onClickInclude: OnClickInclude;
  pinnedLibraries?: Libs_CreateApi;
  getCustomLibraries: GetCustomLibraries;
  getFavoriteLibraries: GetFavoriteLibraries;
  getBoards: GetBoards;
  selectedBoard?: string;
  selectedArchitecture?: string;
  canModifySketchMetadata?: boolean;
  libraryMenuHandlers: LibraryMenuHandlerDictionary;
  enableGetCustomLibraries: boolean;
  initialSelectedTab?: SidenavLibrariesIds;
  hydrateExamplesByPaths: (paths: string[]) => Promise<void>;
};

type RetrieveExampleFileContentsResult = Omit<
  ArduinoBuilderExampleFile_BuilderApi,
  'name' | 'data' | 'path' | 'href'
> & {
  name: string;
  fullName: string;
  data: string;
  path: string;
  href: string;
  content: string;
  extension: string;
  exampleInoPath?: string;
};

export type GetExampleFileContents = <
  T extends { path: string; name: string } | undefined,
>(
  enabled: boolean,
  onSuccess?: (data: RetrieveExampleFileContentsResult) => void,
  exampleInoPath?: string,
  exampleFiles?: T[],
) => {
  exampleFileContents: RetrieveExampleFileContentsResult[];
  allContentsRetrieved: boolean;
  refetchAll: () => void;
};

export type GetBoards = () => {
  data?: GetBoards_Response;
  isLoading: boolean;
};

export type SetFavoriteLibrary = (
  library: SidenavStandardLibrary,
  asFavorite: boolean,
) => void;

export type GetLibraries = (
  params: GetLibraries_Params,
  enabled: boolean,
) => {
  libraries?: SidenavStandardLibrary[];
  isLoading: boolean;
  setFavorite: SetFavoriteLibrary;
  isFetchingNextPage: boolean;
  fetchNextPage: (
    arg?: FetchNextPageOptions | undefined,
  ) => Promise<InfiniteQueryObserverResult<GetLibraries_Response, unknown>>;
  hasNextPage?: boolean;
  fromParams?: string;
};

export type GetCustomLibraries = (
  enabled: boolean,
  codeEnabled: boolean,
) => {
  customLibraries?: GetLibrariesList_Response;
  customLibrariesAreLoading: boolean;
};

export type GetFavoriteLibraries = (enabled?: boolean) => {
  data?: GetFavoriteLibraries_Response;
  isLoading: boolean;
  isError: boolean;
  setFavorite: SetFavoriteLibrary;
};

export type GetLibrary = (
  params: GetLibrary_Params,
  enabled: boolean,
) => {
  library?: Omit<LibraryDetails_Response, 'examples'> & {
    examples?: Example[];
  };
  isLoading: boolean;
  refetch: () => void;
};

export type GetCustomLibrary = (
  queryKey: QueryKey,
  enabled: boolean,
  bypassOrgHeader: boolean,
  onError?: (error: unknown) => void,
  path?: string,
  isLibrary?: boolean,
) => {
  filesList?: GetFilesList_Response;
  getFilesIsLoading: boolean;
  getFilesIsError: boolean;
  refetch: () => void;
};

export type SidenavSections = {
  [Property in SidenavItemId]: (
    logic: ContentLogicMap[Property],
    key?: string,
  ) => JSX.Element;
};

export type HeaderMap = {
  [Property in SidenavItemId]: (
    logic: HeaderLogicMap[Property],
    key?: string,
  ) => React.ReactNode;
};

export interface Section<T extends SidenavItemWithId> {
  item: T;
  logic: ContentLogicMap[T['id']];
  render: SidenavSections[T['id']];
  headerLogic: HeaderLogicMap[T['id']];
  renderHeader: HeaderMap[T['id']];
}

export interface ExampleFile {
  name: string;
  path: string;
}

export interface Example {
  name: string;
  path: string;
  folder?: string;
  types?: string[];
  ino?: ExampleFile;
  files?: ExampleFile[];
}

export interface ExamplesFolder {
  name: string;
  examples: ExampleItem[];
  examplesNumber: number;
}

export type CustomLibraryExamplesFolder = {
  name: string;
  path: string;
  examplesNumber: number;
};

export type ExampleItem = Example | ExamplesFolder;

export type CustomLibraryExampleItem = Example | CustomLibraryExamplesFolder;

export type UseFilesLogic = () => {
  files: SelectableFileData[];
  isLoading: boolean;
  selectedFileId?: string;
  unsavedFileIds: Set<string> | undefined;
  newFileAction: (key: Key | null) => void;
  selectedFileChange: (fileId: string) => void;
  renameFile: RenameFileHandler;
  deleteFile: DeleteFileHandler;
  validateFileName: (
    newName: string,
    prevName: string,
    ext: string,
  ) => FileNameValidationResult;
  replaceFileNameInvalidCharacters: (fileName: string) => string;
  isReadOnly: boolean;
};

export type GetExamples = (enableGetExamples?: boolean) => {
  examples: Example[];
  isLoading: boolean;
};

export type UseExamplesLogic = () => {
  getExamples: GetExamples;
  initialSelectedTab?: SidenavExamplesIds;
  selectedBoard?: string;
  selectedArchitecture?: string;
  hydrateByPaths: (paths: string[]) => Promise<void>;
};

export type GetExampleLinkSearch = (
  exampleID: unknown,
  sourceLibraryID: unknown,
  customLibraryID: unknown,
) => {
  [key: string]: unknown;
};

export function isExamplesFolder(data: ExampleItem): data is ExamplesFolder {
  return Boolean(
    data.name &&
      (data as ExamplesFolder).examples &&
      (data as ExamplesFolder).examplesNumber >= 0,
  );
}

export function isCustomLibraryExamplesFolder(
  data: CustomLibraryExampleItem,
): data is CustomLibraryExamplesFolder {
  return Boolean((data as CustomLibraryExamplesFolder).examplesNumber >= 0);
}

export type GetReferenceCategories = (langCode?: string) => {
  categoryTree: CategoryTree | undefined;
  allEntries: Map<string, ReferenceEntry> | undefined;
  isLoading: boolean;
};

export type GetReferenceItem = (
  params: {
    path: ReferencePath;
  },
  enabled: boolean,
) => {
  referenceItem: ReferenceItem | undefined;
  isLoading: boolean;
};

export type SearchReferenceItem = (
  params: { query: string },
  enabled: boolean,
) => {
  searchResult: ReferenceSearchResult | undefined;
  isLoading: boolean;
};

export type UseReferenceLogic = () => {
  getReferenceCategories: GetReferenceCategories;
  getReferenceItem: GetReferenceItem;
  searchReferenceItem: SearchReferenceItem;
  selectedTab: SidenavReferenceIds;
  setSelectedTab: (tab: SidenavReferenceIds) => void;
};

export type GenAIChatMessage = ThreadMessage & {
  data: HumanContent_GenAiApi | AssistantContent_GenAiApi;
  retrievedDocuments?: RetrievedDocument[];
  tag?: string;
  initiatingMessageId?: string;
  senderDisplayName?: string;
};

export type RetrievedDocumentsIconDictionary = {
  [key in RetrievedDocumentType]: FunctionComponent<
    SVGProps<SVGSVGElement> & { title?: string | undefined }
  >;
};

export const retrievedDocumentsIconDictionary: RetrievedDocumentsIconDictionary =
  {
    [RetrievedDocumentType.Tutorial]: CodeIcon, // TODO: replace with Tutorial icon
    [RetrievedDocumentType.Example]: CodeIcon,
    [RetrievedDocumentType.TechReference]: TechReference,
  };

export type GenAIConversation = GenAIChatMessage[];

export type SurveyType = 'positive' | 'negative';

export enum SketchPlanActionType {
  ConfirmSketchPlan = 'confirmSketchPlan',
  RefreshSketchPlan = 'refreshSketchPlan',
  CancelSketchPlan = 'cancelSketchPlan',
}

export type UseGenAILogic = () => {
  handleGenAiApplyCode: OnClickApplySketch;
  handleGenAiApplyFixToCode: OnClickApplyFixToSketch;
  handleApplyPatchAvailability: ApplyPatchAvailability;
  scrollToLine: (line: number, fileName?: string) => void;
  errorLines?: number[];
  genAiMessageUsageExceeded?: boolean;
  shouldDisplayAiLimitBanner?: boolean;
  aiMessagesRemaining?: number;
  linksEnabled: boolean;
  openGenAIPolicyTermsDialog: () => void;
  onUserInput: (text: string) => void;
  maxContentLength: number;
};

export type UseSettingsLogic = () => {
  getPreference: (id: Preferences) => PreferenceValue | undefined;
  setPreference: (id: Preferences, value: PreferenceValue) => void;
  restorePreferences: () => void;
  themeContext: {
    theme: string;
    setTheme: React.Dispatch<React.SetStateAction<string>>;
    isDarkModeOs: boolean;
  };
  saveAllFiles: () => void;
  handleOptOut?: () => void;
};

export enum SidenavExamplesIds {
  Device = 'Device',
  BuiltIn = 'BuiltIn',
  FromLibraries = 'FromLibraries',
}

export enum SidenavLibrariesIds {
  Standard = 'Standard',
  Custom = 'Custom',
  Favorites = 'Favorites',
}

export enum SidenavReferenceIds {
  Functions = 'Functions',
  Variables = 'Variables',
  Structure = 'Structure',
}

export type SidenavTabsIds =
  | SidenavExamplesIds
  | SidenavLibrariesIds
  | SidenavReferenceIds;

export type SidenavTabItem =
  | {
      id: SidenavExamplesIds;
      label: MessageDescriptor;
    }
  | {
      id: SidenavLibrariesIds;
      label: MessageDescriptor;
    }
  | {
      id: SidenavReferenceIds;
      label: MessageDescriptor;
    };

export type SidenavTabAction = () => void;

export type SidenavExamplesDictionary<T> = { [K in SidenavExamplesIds]: T };
export type SidenavLibrariesDictionary<T> = { [K in SidenavLibrariesIds]: T };
export type SidenavReferenceDictionary<T> = { [K in SidenavReferenceIds]: T };

export type SidenavExamplesItemDictionary =
  SidenavExamplesDictionary<SidenavTabItem>;
export type SidenavExamplesHandlerDictionary =
  SidenavExamplesDictionary<SidenavTabAction>;

export type SidenavLibrariesItemDictionary =
  SidenavLibrariesDictionary<SidenavTabItem>;
export type SidenavLibrariesHandlerDictionary =
  SidenavLibrariesDictionary<SidenavTabAction>;

export type SidenavReferenceItemDictionary =
  SidenavReferenceDictionary<SidenavTabItem>;

export enum ExamplesMenuItemIds {
  CopyInYourSketches = 'CopyInYourSketches',
  Download = 'Download',
}

export type CopyInYourSketchesType = (
  exampleID: string,
  sourceLibraryID?: string,
  customLibraryID?: string,
) => void;

type RetrieveFileContentsResult = Pick<
  GetFile_ResponseWithName & GetFile_ResponseWithContents,
  'mimetype' | 'path' | 'data' | 'href'
> & {
  name: string;
  fullName: string;
  content: string;
  extension: string;
};

export type DownloadType = (
  examplePath: string,
  exampleFiles: RetrieveFileContentsResult[],
) => void;

export type ExamplesMenuType = {
  [ExamplesMenuItemIds.CopyInYourSketches]: CopyInYourSketchesType;
  [ExamplesMenuItemIds.Download]: DownloadType;
};

export type ExamplesMenuItemType = DropdownMenuItemType<
  ExamplesMenuItemIds,
  MessageDescriptor
>;
export type ExamplesMenuSection = DropdownMenuSectionType<
  ExamplesMenuItemIds,
  MessageDescriptor
>;

export type ExamplesMenuDictionary<T> = { [K in ExamplesMenuItemIds]: T };
export type ExamplesMenuItemDictionary =
  ExamplesMenuDictionary<ExamplesMenuItemType>;
export type ExamplesMenuHandlerDictionary = {
  [K in ExamplesMenuItemIds]: ExamplesMenuType[K];
};

export enum LibraryMenuHandlersIds {
  CopyAndModify = 'CopyAndModify',
  Modify = 'Modify',
  Delete = 'Delete',
  Download = 'Download',
}
type LibraryMenuType = (
  library: SidenavStandardLibrary | SidenavCustomLibrary,
) => void;
export type LibraryMenuDictionary<T> = { [K in LibraryMenuHandlersIds]: T };
export type LibraryMenuHandlerDictionary =
  LibraryMenuDictionary<LibraryMenuType>;

export enum FileMenuItemIds {
  Rename = 'Rename',
  Delete = 'Delete',
}

export enum NewFileMenuItemIds {
  AddSketchFile = 'AddSketchFile',
  AddHeaderFile = 'AddHeaderFile',
  AddTextFile = 'AddTextFile',
  AddSecretsTab = 'AddSecretsTab',
  ImportFile = 'ImportFile',
}

export type FileMenuSection = DropdownMenuSectionType<
  NewFileMenuItemIds | FileMenuItemIds,
  MessageDescriptor
>;
export type FileMenuItemType = DropdownMenuItemType<
  NewFileMenuItemIds | FileMenuItemIds,
  MessageDescriptor
>;

export type FileMenuType = (
  fileId: string,
  fileName: string,
  fileExtension: string,
) => void;

export type FileMenuDictionary<T> = { [K in FileMenuItemIds]: T };
export type FileMenuItemDictionary = FileMenuDictionary<FileMenuItemType>;
export type FileMenuHandlerDictionary = FileMenuDictionary<FileMenuType>;

export type NewFileMenuDictionary<T> = { [K in NewFileMenuItemIds]: T };
export type NewFileMenuItemDictionary = NewFileMenuDictionary<FileMenuItemType>;
