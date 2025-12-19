import {
  BoardUpdateLog,
  UpdateCheckResult,
} from '@cloud-editor-mono/infrastructure';

export enum AppLabSettingsItemId {
  Storage = 'storage',
  Network = 'network',
  Documentation = 'documentation',
  BoardUpdate = 'board-update',
}

export type AppLabSettingsItem = {
  id: AppLabSettingsItemId;
  title: string;
  subtitle: string;
  icon: string;
  isEnabled: boolean;
};

export type NetworkItem = string;

export enum SecurityProtocols {
  WEP = 'WEP',
  WPA = 'WPA',
  WPA2 = 'WPA2',
  WPA3 = 'WPA3',
}

export type NetworkCredentials = {
  name: string;
  password: string;
  security: SecurityProtocols;
};

export type UseSettingsLogic = () => {
  contentLogicMap: ContentLogicMap;
};

export type UseStorageLogic = () => {
  storageInfo?: string;
};

export type KeyboardLayout = {
  id: string;
  label: string;
};

export type UseBoardConfigurationLogic = () => {
  hasBoardConfigurationError: boolean;
  checkBoardName: (name: string | undefined) => boolean;
  proposeName: () => string;
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
  userPasswordChecked: boolean;
  userPasswordIsSet: boolean;
  setUserPassword: (password: string, passwordConfirmation: string) => void;
  setUserPasswordIsLoading: boolean;
  setUserPasswordIsError: boolean;
  setUserPasswordConfirmationIsError: boolean;
  setUserPasswordIsSuccess: boolean;
  userPasswordErrorMsg: string;
  userPasswordConfirmationErrorMsg: string;
};

export type UseNetworkLogic = () => {
  networkList: NetworkItem[];
  isScanning: boolean;
  scanNetworkList: () => void;
  connectToWifiNetwork: (network: NetworkCredentials) => void;
  isNetworkStatusLoading?: boolean;
  networkStatusChecked: boolean;
  isConnected?: boolean;
  isStatusConnecting?: boolean;
  isConnecting?: boolean;
  connectRequestIsError?: boolean;
  connectRequestIsSuccess?: boolean;
  selectedNetwork?: NetworkItem;
  setSelectedNetwork: (network?: NetworkItem) => void;
  manualNetworkSetup: boolean;
  setManualNetworkSetup: (manualSetup: boolean) => void;
};

export type UseConnectionLost = (
  setupCompleted: boolean,
  isConnected?: boolean,
  onConnectionLost?: () => void,
) => void;

export type UseBoardUpdateLogic = () => {
  boardUpdateLogs: BoardUpdateLog[];
  isGettingLogs: boolean;
  onlyArduino: boolean;
  setOnlyArduino: (onlyArduino: boolean) => void;
  updateCheckResult: UpdateCheckResult | undefined;
  isCheckingBoardUpdate: boolean;
  isStartingBoardUpdate: boolean;
  checkBoardUpdate: () => Promise<void>;
  applyBoardUpdate: () => Promise<boolean | null>;
  cleanup: () => void;
};
export type UseDocumentationLogic = () => {
  documentationInfo?: string;
};

export interface ContentLogicMap {
  [AppLabSettingsItemId.Storage]: UseStorageLogic;
  [AppLabSettingsItemId.Network]: UseNetworkLogic;
  [AppLabSettingsItemId.BoardUpdate]: UseBoardUpdateLogic;
  [AppLabSettingsItemId.Documentation]: UseDocumentationLogic;
}

export type SettingsSections = {
  [Property in AppLabSettingsItemId]: (
    logic: ContentLogicMap[Property],
  ) => React.ReactNode;
};
export interface Section<T extends AppLabSettingsItem> {
  item: T;
  logic: ContentLogicMap[T['id']];
  render: SettingsSections[T['id']];
}
