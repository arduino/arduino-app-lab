import { defineMessages } from 'react-intl';

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
    defaultMessage:
      'No networks found. Ensure your router is on, the credentials are right and the board is within range, then try again.',
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
    defaultMessage: 'Scanning Networks...',
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
    defaultMessage: 'Setup manually',
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

export const skipNetworkMessages = defineMessages({
  title: {
    id: 'appLabSettings.network.skipTitle',
    defaultMessage: 'Wi-Fi connection',
    description: 'Title for the skip Wi-Fi connection confirmation dialog',
  },
  subtitle: {
    id: 'appLabSettings.network.skipSubtitle',
    defaultMessage:
      "Are you sure you don't want to connect your board to a Wi-Fi?",
    description:
      'Subtitle for the skip Wi-Fi connection confirmation dialog, asking the user if they are sure about skipping Wi-Fi setup',
  },
  description: {
    id: 'appLabSettings.network.skipDescription',
    defaultMessage:
      "Without a Wi-Fi connection, you'll miss out on key features like:",
    description:
      'Description for the skip Wi-Fi connection confirmation dialog, explaining the benefits of connecting to Wi-Fi and that it can be done later in settings',
  },
  descriptionListItem1: {
    id: 'appLabSettings.network.skipDescriptionListItem1',
    defaultMessage: 'Latest updates for Linux packages and Bricks',
    description:
      'First item in the list of benefits for connecting to Wi-Fi in the skip Wi-Fi connection confirmation dialog',
  },
  descriptionListItem2: {
    id: 'appLabSettings.network.skipDescriptionListItem2',
    defaultMessage: 'Automatic updates for Arduino App Lab',
    description:
      'Second item in the list of benefits for connecting to Wi-Fi in the skip Wi-Fi connection confirmation dialog',
  },
  descriptionListItem3: {
    id: 'appLabSettings.network.skipDescriptionListItem3',
    defaultMessage: 'Seamless connection to your Arduino Account',
    description:
      'Third item in the list of benefits for connecting to Wi-Fi in the skip Wi-Fi connection confirmation dialog',
  },
  descriptionListItem4: {
    id: 'appLabSettings.network.skipDescriptionListItem4',
    defaultMessage: 'Enabling Remote Development capabilities',
    description:
      'Fourth item in the list of benefits for connecting to Wi-Fi in the skip Wi-Fi connection confirmation dialog',
  },
  skipButton: {
    id: 'appLabSettings.network.skip',
    defaultMessage: 'Skip Wi-Fi connection',
    description: 'Button label to skip Wi-Fi network setup',
  },
  connectButton: {
    id: 'appLabSettings.network.connect',
    defaultMessage: 'Connect Wi-Fi',
    description: 'Button label to go back to Wi-Fi network setup',
  },
});
