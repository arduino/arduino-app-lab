import { UseArduinoAccountLogic } from '../account';
import { BoardItem } from '../board-section';
import { UseNetworkLogic } from '../network';

export type ConnectionType = 'USB' | 'Network' | 'Local';

export type Board = {
  id: string;
  isSelecting?: boolean;
  checkingStatus?: boolean;
  name: string;
  fqbn: string;
  type: string;
  connectionType: ConnectionType;
  protocol: string;
  serial: string;
  address: string;
};

export type KeyboardLayout = {
  id: string;
  label: string;
};

export type CarrierDeviceType = 'camera' | 'display';

export type CarrierDeviceStatus = {
  device: string;
  option: string;
  deviceType: CarrierDeviceType;
};

export type CarrierStatus = {
  carrierName: string;
  current: CarrierDeviceStatus[];
  currentEnabled: boolean;
  next: CarrierDeviceStatus[];
  nextEnabled: boolean;
};

export type CarriersStatus = {
  carriers: CarrierStatus[];
};

export type CarrierDevice = {
  name: string;
  deviceType: CarrierDeviceType;
  availableDevices: string[];
};

export type Carrier = {
  name: string;
  devices: CarrierDevice[];
};

export type UseBoardConfigurationLogic = () => {
  hasBoardConfigurationError: boolean;
  checkBoardName: (name: string | undefined) => boolean;
  proposeName: () => string;
  setBoardName: (name: string) => void;
  setKeyboardLayout: (layout: string) => void;
  boardConfigurationChecked: boolean;
  boardConfigurationIsSet: boolean;
  boardName: string | undefined;
  keyboardLayout: string | undefined;
  keyboardLayouts: KeyboardLayout[];
  setBoardConfiguration: (boardName: string, keyboardLayout: string) => void;
  skipBoardConfiguration: () => void;
  setBoardConfigurationIsLoading: boolean;
  setBoardNameIsError: boolean;
  setBoardNameIsSuccess: boolean;
  setKeyboardLayoutIsError: boolean;
  setKeyboardLayoutIsSuccess: boolean;
  setBoardConfigurationIsSuccess: boolean;
  boardNameErrorMsg: string;
  keyboardLayoutErrorMsg: string;
};

export type UseLinuxCredentialsLogic = () => {
  isVentunoQ: boolean;
  userPasswordChecked: boolean;
  userPasswordIsSet: boolean;
  setUserPassword: (
    password: string,
    passwordConfirmation: string,
    onSuccess?: (password: string) => void,
  ) => void;
  setUserPasswordIsLoading: boolean;
  setUserPasswordIsError: boolean;
  setUserPasswordConfirmationIsError: boolean;
  setUserPasswordIsSuccess: boolean;
  userPasswordErrorMsg: string;
  userPasswordConfirmationErrorMsg: string;
};

export type UseConnectionLost = (
  setupCompleted: boolean,
  isConnected?: boolean,
  onConnectionLost?: () => void,
) => void;

export type UseSetupLogic = () => {
  isBoard?: boolean;
  boards: Board[];
  selectedBoard: Board | undefined;
  selectingBoard?: Board;
  selectBoard: (board: Board) => Promise<void>;
  autoSelectBoard: (boardId: string) => Promise<void>;
  isAutoSelectingBoard: boolean;
  showLoader: boolean;
  showBoardSelectionPage: boolean;
  showPostSelectionSetup: boolean;
  currentStep?: SetupItemId;
  stepIsSkippable?: boolean;
  contentLogicMap?: SetupContentLogicMap;
  showBoardConnPswPrompt: boolean;
  onConnPswCancel: () => void;
  onConnPswSubmit: (password: string) => Promise<void>;
  isBoardConnectingOrChecking: boolean;
  connToBoardError?: string;
  showConfirmButton?: boolean;
  boardItem?: BoardItem;
  onOpenTerminal: () => Promise<void>;
  terminalError: string | null;
  onBackStep?: () => void;
  unlockAutoFlow?: () => void;
  setupCompleted?: boolean;
  boardSelectionStatus?:
    | 'selection-started'
    | 'conn-started'
    | 'conn-error'
    | 'conn-and-selection-done';
};

export enum SetupItemId {
  BoardConfiguration,
  NetworkSetup,
  LinuxCredentials,
  ArduinoAccount,
}

export interface SetupContentLogicMap {
  [SetupItemId.BoardConfiguration]: UseBoardConfigurationLogic;
  [SetupItemId.NetworkSetup]: UseNetworkLogic;
  [SetupItemId.LinuxCredentials]: UseLinuxCredentialsLogic;
  [SetupItemId.ArduinoAccount]: UseArduinoAccountLogic;
}

export type SetupItem = {
  id: SetupItemId;
  enabled: boolean;
};

export type SetupSections = {
  [Property in SetupItemId]: (
    logic: SetupContentLogicMap[Property],
    ref: React.RefObject<{
      confirm: () => void;
      skip?: () => void;
    }>,
    unlockAutoFlow?: () => void,
  ) => [boolean, React.ReactNode];
};

export interface SetupSection<T extends SetupItem> {
  item: T;
  logic: SetupContentLogicMap[T['id']];
  render: SetupSections[T['id']];
}
