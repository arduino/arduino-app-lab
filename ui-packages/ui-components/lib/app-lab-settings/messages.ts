import { defineMessages } from 'react-intl';

export const settingsMessages = defineMessages({
  loadingSettings: {
    id: 'appLabSettings.settings.loadingSettings',
    defaultMessage: 'Loading settings...',
    description: 'Message displayed while settings are being loaded',
  },
});

export const networkMessages = defineMessages({
  networkName: {
    id: 'appLabSettings.network.networkName',
    defaultMessage: 'Network Name',
    description: 'Label for the Wi-Fi network name input field',
  },
  networkPassword: {
    id: 'appLabSettings.network.networkPassword',
    defaultMessage: 'Password',
    description: 'Label for the Wi-Fi network password input field',
  },
  networkSecurity: {
    id: 'appLabSettings.network.networkSecurity',
    defaultMessage: 'Security',
    description: 'Label for the Wi-Fi network security type dropdown',
  },
  networkConnected: {
    id: 'appLabSettings.network.networkConnected',
    defaultMessage: 'Connected',
    description: 'Message displayed when the Wi-Fi network is connected',
  },
  networkError: {
    id: 'appLabSettings.network.networkError',
    defaultMessage: 'Error connecting, please try again',
    description:
      'Message displayed when there is an error connecting to the Wi-Fi network',
  },
  changeNetwork: {
    id: 'appLabSettings.network.changeNetwork',
    defaultMessage: 'Change Network',
    description: 'Button label to change the Wi-Fi network',
  },
  connectToNetwork: {
    id: 'appLabSettings.network.connectToNetwork',
    defaultMessage: 'Connect',
    description: 'Button label to connect to a selected Wi-Fi network',
  },
  connectingToNetwork: {
    id: 'appLabSettings.network.connectingToNetwork',
    defaultMessage: 'Connecting...',
    description: 'Message displayed while connecting to a Wi-Fi network',
  },
  noAvailableNetworks: {
    id: 'appLabSettings.network.noAvailableNetworks',
    defaultMessage: 'No available networks found',
    description: 'Message displayed when no Wi-Fi networks are available',
  },
  scanningForNetworks: {
    id: 'appLabSettings.network.scanningForNetworks',
    defaultMessage: 'Scanning for available networks...',
    description: 'Message displayed while scanning for Wi-Fi networks',
  },
  chooseNetwork: {
    id: 'appLabSettings.network.chooseNetwork',
    defaultMessage: 'Choose a network to access',
    description: 'Label for the network selection dropdown',
  },
  scanAgain: {
    id: 'appLabSettings.network.scanAgain',
    defaultMessage: 'Scan again',
    description: 'Button label to scan for Wi-Fi networks again',
  },
  noNetworksWarning: {
    id: 'appLabSettings.network.noNetworksWarning',
    defaultMessage:
      'No networks found. Ensure your router is on, the credentials are right and the board is within range, then try again.',
    description: 'Warning message when no Wi-Fi networks are found',
  },
  addNetworkManually: {
    id: 'appLabSettings.network.addNetworkManually',
    defaultMessage: 'Add network manually',
    description: 'Button label to add a Wi-Fi network manually',
  },
  setupManualNetwork: {
    id: 'appLabSettings.network.setupManualNetwork',
    defaultMessage: 'Manual setup',
    description: 'Title for the manual network setup section',
  },
  wpa2: {
    id: 'appLabSettings.network.wpa2',
    defaultMessage: 'WPA2',
    description: 'Label for WPA2 security type in Wi-Fi settings',
  },
  wep: {
    id: 'appLabSettings.network.wep',
    defaultMessage: 'WEP',
    description: 'Label for WEP security type in Wi-Fi settings',
  },
  none: {
    id: 'appLabSettings.network.none',
    defaultMessage: 'None',
    description: 'Label for no security type in Wi-Fi settings',
  },
});
