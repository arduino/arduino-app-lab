import { SettingsService } from './settings-service.type';

export let getNetworkList: SettingsService['getNetworkList'] =
  async function () {
    throw new Error('getNetworkList service not implemented');
  };

export let getWiFiStatus: SettingsService['getWiFiStatus'] = async function () {
  throw new Error('isWiFiConnected service not implemented');
};

export let getEthernetStatus: SettingsService['getEthernetStatus'] =
  async function () {
    throw new Error('getEthernetStatus service not implemented');
  };

export let getInternetStatus: SettingsService['getInternetStatus'] =
  async function () {
    throw new Error('getInternetStatus service not implemented');
  };

export let connectToWiFi: SettingsService['connectToWiFi'] = async function (
  _ssid: string,
  _password: string,
) {
  throw new Error('connectToWiFi service not implemented');
};

export let disconnectWiFi: SettingsService['disconnectWiFi'] =
  async function () {
    throw new Error('disconnectWiFi service not implemented');
  };

export let getConnectionName: SettingsService['getConnectionName'] =
  async function () {
    throw new Error('getConnectionName service not implemented');
  };

export let getIPAddress: SettingsService['getIPAddress'] = async function () {
  throw new Error('getIPAddress service not implemented');
};

export const setSettingsService = (service: SettingsService): void => {
  getNetworkList = service.getNetworkList;
  getEthernetStatus = service.getEthernetStatus;
  getWiFiStatus = service.getWiFiStatus;
  connectToWiFi = service.connectToWiFi;
  disconnectWiFi = service.disconnectWiFi;
  getInternetStatus = service.getInternetStatus;
  getConnectionName = service.getConnectionName;
  getIPAddress = service.getIPAddress;
};
