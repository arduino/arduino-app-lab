import { DropdownMenuSectionType } from '../../../essential/dropdown-menu';

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

export type SecurityProtocolSection = DropdownMenuSectionType<
  SecurityProtocols,
  string
>;

export type UseNetworkLogic = () => {
  networkList: NetworkItem[];
  isScanning: boolean;
  setScanningIsEnabled: (enabled: boolean) => void;
  scanNetworkList: () => void;
  connectToWifiNetwork: (network: NetworkCredentials) => void;
  disconnectFromNetwork: () => Promise<void>;
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
  onSkipNetworkSetup?: () => void;
  draftNetworkCredentials?: NetworkCredentials;
  setDraftNetworkCredentials?: (v: NetworkCredentials) => void;
};
