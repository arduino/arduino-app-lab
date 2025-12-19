import { FileLineScope } from '@cloud-editor-mono/common';
import {
  BoardFlavourOptions,
  CompileErrors,
  CompileSketch_Body_WithCompleteSketch,
  GetCustomLibraryResult,
  GetSketchResult,
  RetrieveExampleFileContentsResult,
  RetrieveFileContentsResult,
} from '@cloud-editor-mono/domain';
import {
  ArduinoBuilderV2CompilationsResponse_BuilderApi,
  DeleteSketchFile_Response,
  GetBoardByFqbn_Response,
  GetSketch_Response,
  isBuilderSketchFileFull,
  ManagedOtaErrors,
  PostSketchFile_Response,
  SketchData,
} from '@cloud-editor-mono/infrastructure';
import {
  ConsolePanelLogic,
  ConsolePanelStatus,
  DeleteFileDialogLogic,
  DeleteLibraryDialogLogic,
  DeleteSecretDialogLogic,
  DeleteSketchDialogLogic,
  DependentSidenavLogic,
  DetectedDevices,
  DeviceAssociationDialogLogic,
  Devices,
  EditorPanelLogic,
  Example,
  ExamplesMenuHandlerDictionary,
  FlavourConfigDialogLogic,
  GenAiBannerLogic,
  GenAIPolicyTermsDialogLogic,
  IotDevicesGroups,
  IsUploading,
  LibraryMenuHandlerDictionary,
  OnboardingLogic,
  ReadOnlyBarLogic,
  RenameDialogLogic,
  SelectableFileData,
  SetDetectedBoardAndPort,
  SetDetectedUnknownBoard,
  SetUndetectedBoard,
  ShareSketchDialogLogic,
  ShareToClassroomDialogLogic,
  ToolbarLogic,
} from '@cloud-editor-mono/ui-components';
import {
  AddFileHandler,
  DeleteFileHandler,
  MakeUniqueFileName,
  OnBeforeFileAction,
  RenameFileHandler,
  ValidateFileName,
} from '@cloud-editor-mono/ui-components/lib/editor-tabs-bar';
import { Key } from 'react';

import { UseFiles } from '../../../common/hooks/files.type';
import { SaveSketchFileMutation } from '../../../common/hooks/queries/create.type';
import { Progression } from '../../../common/hooks/queries/iot.type';
import { DialogDataDictionary, DialogId } from '../dialog-switch';
import { HeaderLogic } from '../header';

export type UseGetSketchStartUpQueries = (
  isLibraryRoute: boolean,
  isExampleSketchRoute: boolean,
) => {
  sketchData?: GetSketchResult;
  sketchBoardData?: GetBoardByFqbn_Response;
  modifySketchData: (newData: Partial<SketchData>) => void;
  mainInoData?: RetrieveFileContentsResult;
  files?: RetrieveFileContentsResult[];
  sketchDataIsNotLoaded?: boolean;
  userWasAuthenticated: boolean;
  fileIsDeleting: boolean;
  deleteSketchFile: (path?: string) => Promise<DeleteSketchFile_Response>;
  renameSketchFile: (from?: string, to?: string) => Promise<void>;
  addSketchFile: (
    fileId: string,
    fileName: string,
    fileExtension: string,
    code?: string,
  ) => Promise<PostSketchFile_Response>;
  isPrivateSketchViewedFromOrg: boolean;
  invalidateFilesList: () => void;
  refreshFileList: () => void;
  allContentsRetrieved: boolean;
};

export type UseGetExamplesQueries = (
  userWasAuthenticated: boolean,
  isExampleSketchRoute: boolean,
) => {
  example?: Example;
  exampleData?: RetrieveExampleFileContentsResult;
  exampleFiles?: RetrieveExampleFileContentsResult[];
  exampleIsFromLibrary?: boolean;
  exampleIsFromCustomLibrary?: boolean;
  exampleIsLoading?: boolean;
  examplesMenuHandlers: ExamplesMenuHandlerDictionary;
  allContentsRetrieved: boolean;
  hydrateByPaths: (paths: string[]) => Promise<void>;
};

export type UseGetLibrariesQueries = (
  userWasAuthenticated: boolean,
  isLibraryRoute: boolean,
) => {
  customLibraryIsLoading: boolean;
  customLibraryFilesAreLoading: boolean;
  customLibrary?: GetCustomLibraryResult;
  customLibraryFiles?: RetrieveFileContentsResult[];
  libraryMenuHandlers: LibraryMenuHandlerDictionary;
  onLibraryUpload: () => void;
  isUploadingLibrary: boolean;
  allContentsRetrieved: boolean;
};

export interface BaseUploadCommandOptions {
  _?: unknown;
  existingCompilation?: ArduinoBuilderV2CompilationsResponse_BuilderApi;
}

export type CoreCommandType = 'verify' | 'upload';

export type UseCoreCommands = (
  isReadOnly: boolean,
  isExampleSketchRoute: boolean,
  isLibraryRoute: boolean,
  modifySketchData: (newData: Partial<SketchData>) => void,
  isIotSketch: boolean,
  selectedBoardIsIot: boolean,
  saveSketchFileQuery: SaveSketchFileMutation,
  addGenericBypassAutoSelection: ReturnType<UseBoardsConfig>['addGenericBypassAutoSelection'],
  thingDeviceDetailsIsLoading: boolean,
  allContentsRetrieved: boolean,
  refreshThingDeviceDetails: () => void,
  initialInoData?: RetrieveFileContentsResult,
  initialSketchData?: GetSketch_Response | Example,
  initialFilesData?: RetrieveFileContentsResult[],
  selectedFqbn?: string,
  selectedBoard?: string,
  selectedPort?: string,
  selectedIoTDeviceId?: string,
) => {
  uploadCommand: (baseUploadCommandOptions?: BaseUploadCommandOptions) => void;
  isUploading: IsUploading;
  verifyCommand: (
    existingCompilation?: ArduinoBuilderV2CompilationsResponse_BuilderApi,
  ) => void;
  pendingCommand: () => void;
  isVerifying: boolean;
  isPending: boolean;
  isCreating: boolean;
  consolePanelStatus: ConsolePanelStatus;
  compileString?: string;
  compileErrors?: CompileErrors;
  compileResultMessages?: string;
  errorFiles?: string[];
  compileOutputWarnLineStart?: number;
  compileOutputWarnLineEnd?: number;
  uploadOutputWarnLineStart?: number;
  compileErrorsTimestamp?: React.MutableRefObject<number | undefined>;
  iotUploadString?: string;
  consolePanelProgress?: Progression;
  consolePanelErrReason?: ManagedOtaErrors;
  openSerialMonitor: (width: number, height: number) => void;
  serialMonitorActive: boolean;
  sketchDataIncompleteForCommands: boolean;
  shouldCheckForOngoingOta: boolean;
  iotCertIsMigrating?: boolean;
};

interface DialogSwitchLogic {
  deviceAssociationDialogKey?: Key;
  deviceAssociationDialogLogic: DeviceAssociationDialogLogic;
  deleteFileDialogLogic: DeleteFileDialogLogic;
  renameSketchDialogLogic: RenameDialogLogic;
  deleteSketchDialogLogic: DeleteSketchDialogLogic;
  deleteLibraryDialogLogic: DeleteLibraryDialogLogic;
  deleteSecretDialogLogic: DeleteSecretDialogLogic;
  flavourConfigDialogLogic: FlavourConfigDialogLogic;
  shareSketchDialogLogic: ShareSketchDialogLogic;
  shareToClassroomDialogLogic: ShareToClassroomDialogLogic;
  genAIPolicyTermsDialogLogic: GenAIPolicyTermsDialogLogic;
}

export interface VisibilityFromUrl {
  header: boolean;
  toolbarAndConsole: boolean;
  sidenav: boolean;
  infoBar: boolean;
  tabs: boolean;
}

export type UseMainLogic = () => {
  headerLogic: HeaderLogic;
  dependentSidenavLogic: DependentSidenavLogic;
  toolbarLogic: ToolbarLogic;
  editorPanelLogic: EditorPanelLogic;
  consolePanelLogic: ConsolePanelLogic;
  dialogSwitchLogic: DialogSwitchLogic;
  tabTitle?: string;
  isFullscreen: boolean;
  isHeaderless?: boolean;
  isLibraryRoute: boolean;
  onboardingLogic: OnboardingLogic;
  genAiBannerLogic: GenAiBannerLogic;
  visibilityFromUrl: VisibilityFromUrl;
  readOnlyBarLogic: ReadOnlyBarLogic;
  canUseGenAi?: boolean;
  viewMode?: string;
};

export type UseSelectedFile = (
  isLibraryRoute: boolean,
  mainInoFile?: SelectableFileData,
  files?: RetrieveFileContentsResult[],
  libraryFilesAreLoading?: boolean,
) => {
  selectedFile?: SelectableFileData;
  setSelectedFile: (file?: SelectableFileData) => void;
};

export interface AltDevicePortBoardId {
  id: string;
  serialNumber: string;
  isIot: boolean;
}

export type UseGetDevicesList = () => {
  devices: Devices;
  devicesAreLoading: boolean;
};

export type UseBoardsConfig = (
  isExampleSketchRoute: boolean,
  exampleIsLoading: boolean,
  modifySketchData: (newData: Partial<SketchData>) => void,
  promptBoardConfigSelection: (
    data?: DialogDataDictionary[DialogId.DeviceAssociation],
  ) => void,
  sketchDataId: string | null,
  initialFqbn: string | null,
  initialBoard: string | null,
  initialArchitecture: string | null,
  initialBoardType: string | null,
  isIotSketch: boolean,
  initialIotDeviceId?: string | null,
  iotDevicesGroups?: IotDevicesGroups,
) => {
  setDetectedBoardAndPort: SetDetectedBoardAndPort;
  setDetectedUnknownBoard: SetDetectedUnknownBoard;
  setUndetectedBoard: SetUndetectedBoard;
  selectedBoard?: string;
  selectedFqbn?: string;
  selectedArchitecture?: string;
  selectedPort?: string;
  selectedIotDeviceId?: string;
  detectedDevices: DetectedDevices;
  iotDevicesWithAssociationProp?: IotDevicesGroups;
  includesUnknownBoard: boolean;
  manyBoardsMatchMetadata: boolean;
  currentDeviceIsBusy: boolean;
  selectedBoardIsIot: boolean;
  selectedPortBoardId?: string;
  selectedDeviceAltPortBoardId?: AltDevicePortBoardId;
  switchToAltPort: () => void;
  selectedBoardFlavourOptions?: BoardFlavourOptions | null;
  selectedFlavourString?: string | null;
  selectFlavourOptionById: (menuId: string, variantId: string) => void;
  requestWebSerialBoardDetection: () => Promise<void>;
  addGenericBypassAutoSelection: () => string;
  removeGenericBypassAutoSelection: (id: string) => void;
  getDevicesListLogic: UseGetDevicesList;
  changeAssociatedBoard: (data: {
    fqbn: string;
    name: string;
    architecture: string;
  }) => void;
  selectedBoardData?: GetBoardByFqbn_Response;
};

export type UseSketchParams = () => {
  isSketchQueried: boolean;
  sketchID?: string;
  sketchIDIsLoading: boolean;
  libraryID?: string;
  sourceLibraryID?: string;
  customLibraryID?: string;
  exampleID?: string;
  createExampleParam?: boolean;
  createSketchParam?: boolean;
  bypassOptIn?: boolean; // ** to bypass auto opt-in-out redirect in staging
  bypassIotRedirect?: boolean; // ** to bypass auto redirect for iot sketches in staging
  viewMode?: string;
  scope?: FileLineScope;
  highlight?: number[];
  hideNumbers: boolean;
};

export type UseFileHandlers = (
  mainInoFile: SelectableFileData | undefined,
  editorFiles: ReturnType<UseFiles>['editorFiles'],
  openFiles: ReturnType<UseFiles>['openFiles'],
  selectedFile: ReturnType<UseFiles>['selectedFile'],
  selectFile: ReturnType<UseFiles>['selectFile'],
  closeFile: ReturnType<UseFiles>['closeFile'],
  updateOpenFile: ReturnType<UseFiles>['updateOpenFile'],
  addSketchFile: ReturnType<UseGetSketchStartUpQueries>['addSketchFile'],
  renameSketchFile: ReturnType<UseGetSketchStartUpQueries>['renameSketchFile'],
  deleteSketchFile: ReturnType<UseGetSketchStartUpQueries>['deleteSketchFile'],
  exampleInoData?: RetrieveExampleFileContentsResult | undefined,
  exampleFilesData?: RetrieveExampleFileContentsResult[] | undefined,
) => {
  addFileHandler: AddFileHandler;
  renameFileHandler: RenameFileHandler;
  deleteFileHandler: DeleteFileHandler;
  validateFileName: ValidateFileName;
  makeUniqueFileName: MakeUniqueFileName;
  onBeforeFileAction: OnBeforeFileAction;
};

export interface CompleteCommandData {
  initialInoData: CompileSketch_Body_WithCompleteSketch['sketch'] &
    RetrieveFileContentsResult;
  initialSketchData: SketchData;
  initialFilesData?: CompileSketch_Body_WithCompleteSketch['sketch'] &
    RetrieveFileContentsResult[];
}

export type CommandParams =
  | (CompleteCommandData & {
      selectedFqbn: string;
    })
  | undefined;

export const commandDataIsComplete = (commandData: {
  initialInoData: RetrieveFileContentsResult;
  initialSketchData: GetSketch_Response | Example;
  initialFilesData?: RetrieveFileContentsResult[];
}): commandData is CompleteCommandData => {
  const { initialInoData, initialFilesData } = commandData;

  const inoDataIsComplete = isBuilderSketchFileFull(initialInoData);
  const filesDataIsComplete =
    !initialFilesData ||
    initialFilesData.length === 0 ||
    initialFilesData.every(isBuilderSketchFileFull);

  if (!inoDataIsComplete || !filesDataIsComplete) return false;

  return true;
};

export type UseSerialMonitorWindow = (
  deviceName?: string,
  selectedPort?: string,
  isUploading?: boolean,
) => {
  open: (width: number, height: number) => void;
  active: boolean;
};

export function isCreatedSketch(
  data?: Example | SketchData,
): data is SketchData {
  return Boolean(
    data &&
      typeof (data as SketchData).fqbn === 'string' &&
      typeof (data as SketchData).boardName === 'string',
  );
}
