import { NetworkItem } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

export type WiFiConnectionStatus = 'connected' | 'disconnected' | 'connecting';
export type EthernetConnectionStatus =
  | 'connected'
  | 'disconnected'
  | 'connecting';
export interface SettingsService {
  getNetworkList(): Promise<NetworkItem[]>;
  getWiFiStatus(): Promise<WiFiConnectionStatus>;
  getEthernetStatus(): Promise<EthernetConnectionStatus>;
  getInternetStatus(): Promise<boolean>;
  connectToWiFi(ssid: string, password: string): Promise<void | 'timeout'>;
  getConnectionName(): Promise<string | null>;
}
