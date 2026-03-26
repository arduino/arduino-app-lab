import { NetworkItem } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

import type {
  EthernetConnectionStatus,
  SettingsService,
  WiFiConnectionStatus,
} from './settings-service.type';

const mockNetworkList: NetworkItem[] = [
  'Mock WiFi 1',
  'Mock WiFi 2',
  'Timeout WiFi',
];

let wifiStatus: WiFiConnectionStatus = 'disconnected';
let ethernetStatus: EthernetConnectionStatus = 'disconnected';
let internetStatus = false;

export const MockSettingsService: SettingsService = {
  async getNetworkList(): Promise<NetworkItem[]> {
    return [...mockNetworkList];
  },

  async getWiFiStatus(): Promise<WiFiConnectionStatus> {
    return wifiStatus;
  },

  async getEthernetStatus(): Promise<EthernetConnectionStatus> {
    return ethernetStatus;
  },

  async getInternetStatus(): Promise<boolean> {
    return internetStatus;
  },

  async connectToWiFi(ssid: string): Promise<void | 'timeout'> {
    if (ssid === 'Timeout WiFi') {
      wifiStatus = 'connecting';
      internetStatus = false;
      return new Promise((resolve) => {
        setTimeout(() => resolve('timeout'), 100);
      });
    }
    wifiStatus = 'connected';
    ethernetStatus = 'disconnected';
    internetStatus = true;
    return Promise.resolve();
  },

  async disconnectWiFi(): Promise<void> {
    wifiStatus = 'disconnected';
    internetStatus = false;
    return Promise.resolve();
  },

  async getConnectionName(): Promise<string | null> {
    return wifiStatus === 'connected' ? 'Mock WiFi Connection' : null;
  },

  async getIPAddress(): Promise<string | null> {
    return wifiStatus === 'connected' ? '192.168.1.177' : null;
  },
};

export const mockGetNetworkList = (): NetworkItem[] => {
  return [...mockNetworkList];
};
