import { CloudConnectorStatus } from '@cloud-editor-mono/infrastructure';
import {
  AttachCarrierDialogLogic,
  Board,
  BoardResources,
  Carrier,
  CarriersStatus,
  ChangePasswordDialogLogic,
  CloudConnectorConnectDialogLogic,
  CloudConnectorDisconnectDialogLogic,
  KeyboardLayout,
  NetworkItem,
  NetworkSettingsDialogLogic,
  PasswordDialogLogic,
  UnsupportedCarrierDialogLogic,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

export type UseCloudConnectorSettingsLogic = () => {
  status?: CloudConnectorStatus;
  connectBoard: () => void;
  disconnectBoard: () => void;
  connectDialogLogic: CloudConnectorConnectDialogLogic;
  disconnectDialogLogic: CloudConnectorDisconnectDialogLogic;
  isConnecting: boolean;
  isDisconnecting: boolean;
};

export type UseBoardSettingsLogic = () => {
  isBoard: boolean;
  board?: Board;
  boardName?: string;
  boardResources?: BoardResources;
  keyboardLayout: KeyboardLayout | undefined;
  keyboardLayouts: KeyboardLayout[];
  bytesToGiB: (bytes: unknown) => string;
  setBoardName: (name: string) => void;
  setKeyboardLayout: (layout: string) => void;
};

export type UseCarrierSettingsLogic = () => {
  enabled: boolean;
  pristine: boolean;
  onEnabledChange: (enabled: boolean) => void;
  carriers: Carrier[];
  status: CarriersStatus;
  setStatus: (carrierName: string, device: string, option: string) => void;
  unsupportedLogic: UnsupportedCarrierDialogLogic;
  attachLogic: AttachCarrierDialogLogic;
  passwordLogic: PasswordDialogLogic;
};

export type UseNetworkModeLogic = () => PasswordDialogLogic & {
  isNetworkModeEnabled?: boolean;
};

export type UseNetworkSettingsLogic = () => NetworkSettingsDialogLogic & {
  selectedConnectedNetwork?: NetworkItem | null;
  selectedConnectedIPAddress?: string | null;
  openNetworkSettingsDialog: () => void;
};

export type UseSystemSettingsLogic = () => {
  currentAppVersion?: string;
  hasBoardUpdate: boolean;
  needsImageUpdate?: boolean;
  newAppVersion?: string;
  osImageVersion?: string;
  osReleaseDate?: string;
  kernelVersion?: string;
  linuxDistribution?: string;
  openFlasher: () => void;
  startUpdate: () => void;
};

export type UsePasswordSettingsLogic = () => ChangePasswordDialogLogic & {
  openChangePasswordDialog: () => void;
};

export type UseSettingsLogic = () => {
  cloudConnectorSettingsLogic: UseCloudConnectorSettingsLogic;
  boardSettingsLogic: UseBoardSettingsLogic;
  carrierSettingsLogic: UseCarrierSettingsLogic;
  networkModeLogic: UseNetworkModeLogic;
  networkSettingsLogic: UseNetworkSettingsLogic;
  systemSettingsLogic: UseSystemSettingsLogic;
  passwordSettingsLogic: UsePasswordSettingsLogic;
  onOpenExternal: (url: string) => void;
};

export interface SettingsProps {
  settingsLogic: UseSettingsLogic;
  // Optional extra section rendered at the very end, just before the copyright
  // line (with a divider above). Kept as a slot so ui-components doesn't depend
  // on the feature package that provides it (e.g. the AI assistant's Agent panel).
  agentSection?: React.ReactNode;
}
