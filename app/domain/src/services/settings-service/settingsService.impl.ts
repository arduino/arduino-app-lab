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
  ssid: string,
  password: string,
) {
  await new Promise(() =>
    setTimeout(() => {
      console.log('connectToWiFi called with:', ssid, password);
    }, 10000),
  );
  throw new Error('connectToWiFi service not implemented');
};

export let getConnectionName: SettingsService['getConnectionName'] =
  async function () {
    throw new Error('getConnectionName service not implemented');
  };

export const setSettingsService = (service: SettingsService): void => {
  getNetworkList = service.getNetworkList;
  getEthernetStatus = service.getEthernetStatus;
  getWiFiStatus = service.getWiFiStatus;
  connectToWiFi = service.connectToWiFi;
  getInternetStatus = service.getInternetStatus;
  getConnectionName = service.getConnectionName;
};
