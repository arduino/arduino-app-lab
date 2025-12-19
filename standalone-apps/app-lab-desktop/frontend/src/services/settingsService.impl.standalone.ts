/* eslint-disable no-empty */
import {
  EthernetConnectionStatus,
  mockGetNetworkList,
  SettingsService,
  WiFiConnectionStatus,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';

import {
  ConnectToWiFi,
  GetConnectionName,
  GetEthStatus,
  GetInternetStatus,
  GetWiFiStatus,
  ListSSIDs,
} from '../../wailsjs/go/app/App';

export const getNetworkList: SettingsService['getNetworkList'] =
  async function () {
    try {
      const response = await ListSSIDs();
      return response;
    } catch {}
    return mockGetNetworkList();
  };

export const getWiFiStatus: SettingsService['getWiFiStatus'] =
  async function () {
    try {
      const result = await GetWiFiStatus();
      return result as WiFiConnectionStatus;
    } catch (e) {
      console.error(`Failed to get WiFi status: ${e}`);
      return 'disconnected';
    }
  };

export const getEthernetStatus: SettingsService['getEthernetStatus'] =
  async function () {
    try {
      const result = await GetEthStatus();
      return result as EthernetConnectionStatus;
    } catch (e) {
      console.error(`Failed to get ethernet status: ${e}`);
      return 'disconnected';
    }
  };

export const getInternetStatus: SettingsService['getInternetStatus'] =
  async function () {
    try {
      const result = await GetInternetStatus();
      return result as boolean;
    } catch (e) {
      console.error(`Failed to get internet status: ${e}`);
      return false;
    }
  };

export const connectToWiFi: SettingsService['connectToWiFi'] = async function (
  ssid: string,
  password: string,
) {
  try {
    // Set a timeout for the WiFi connection attempt, as it can sometimes hang.
    const timeoutPromise = new Promise<'timeout'>((_, r) => {
      setTimeout(() => r('timeout'), 20000);
    });
    await Promise.race([ConnectToWiFi(ssid, password), timeoutPromise]);
  } catch (e) {
    throw new Error(`Failed to connect to WiFi with SSID ${ssid}: ${e}`);
  }
};

export const getConnectionName: SettingsService['getConnectionName'] =
  async function () {
    try {
      const result = await GetConnectionName();
      return result;
    } catch (e) {
      console.error(`Failed to get connection name: ${e}`);
      return null;
    }
  };
