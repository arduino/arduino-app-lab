import { defineMessages } from 'react-intl';

export const appMessages = defineMessages({
  title: {
    id: 'appLabSettings.app.title',
    defaultMessage: 'Arduino App Lab',
    description: 'Title for the App Lab settings page',
  },
  appLabVersion: {
    id: 'appLabSettings.app.version',
    defaultMessage: 'App Lab version',
    description: 'Label for the App Lab version in the settings page',
  },
  appLabUpToDate: {
    id: 'appLabSettings.app.upToDate',
    defaultMessage: 'Up to date',
    description:
      'Message indicating that the App Lab is up to date in the settings page',
  },
  appLabUpdateAvailable: {
    id: 'appLabSettings.app.updateAvailable',
    defaultMessage: 'Update to App Lab { newAppVersion }',
    description:
      'Message indicating that a new version of App Lab is available in the settings page',
  },
  documentation: {
    id: 'appLabSettings.app.documentation',
    defaultMessage: 'Documentation',
    description: 'Label for the documentation link in the settings page',
  },
  viewDocumentation: {
    id: 'appLabSettings.app.viewDocumentation',
    defaultMessage: 'View documentation',
    description: 'Link to view the documentation for App Lab',
  },
});

export const deviceMessages = defineMessages({
  title: {
    id: 'appLabSettings.device.title',
    defaultMessage: 'Device details',
    description: 'Title for the device details section in the settings page',
  },
  fqbn: {
    id: 'appLabSettings.section.fqbn',
    defaultMessage: 'FQBN',
    description: 'Label for the device FQBN in the settings page',
  },
  serialNumber: {
    id: 'appLabSettings.device.serialNumber',
    defaultMessage: 'Serial number',
    description: 'Label for the device serial number in the settings page',
  },
  diskStorage: {
    id: 'appLabSettings.device.diskStorage',
    defaultMessage: 'Disk storage',
    description: 'Label for the device disk storage usage in the settings page',
  },
  diskStorageUsage: {
    id: 'appLabSettings.device.diskStorageUsage',
    defaultMessage: 'Used: {used} GB of {total} GB',
    description: 'Label for the device disk storage usage in the settings page',
  },
  diskStorageUsageInfo: {
    id: 'appLabSettings.device.diskStorageUsageInfo',
    defaultMessage: 'Storage',
    description:
      'Message providing information about the device disk storage usage in the settings page',
  },
  diskStorageUsageWarning: {
    id: 'appLabSettings.device.diskStorageUsageWarning',
    defaultMessage:
      'Storage is getting full. Free space to keep things running smoothly',
    description:
      'Warning message when the device is running low on disk storage in the settings page',
  },
  diskStorageUsageError: {
    id: 'appLabSettings.device.diskStorageUsageError',
    defaultMessage:
      'Storage is full. Free space to keep things running smoothly',
    description:
      'Error message when the device is out of disk storage in the settings page',
  },
});

export const boardExtensionsMessages = defineMessages({
  title: {
    id: 'appLabSettings.boardExtensions.title',
    defaultMessage: 'Board extensions',
    description: 'Title for the board extensions section in the settings page',
  },
  unsupportedTitle: {
    id: 'appLabSettings.boardExtensions.unsupportedTitle',
    defaultMessage: 'Extensions need a board update',
    description:
      'Title for the unsupported board extensions section in the settings page',
  },
  unsupportedDescription: {
    id: 'appLabSettings.boardExtensions.unsupportedDescription',
    defaultMessage:
      'App Lab can’t tell which extensions your board supports until it’s updated.',
    description:
      'Description for the unsupported board extensions section in the settings page',
  },
  carrierTitle: {
    id: 'appLabSettings.boardExtensions.carrierTitle',
    defaultMessage: 'Carriers connected to your board',
    description: 'Title for the carriers section in the settings page',
  },
  carrierButton: {
    id: 'appLabSettings.boardExtensions.carrierButton',
    defaultMessage: 'How to attach a carrier',
    description: 'Label for the carrier button in the settings page',
  },
  carrierDescription: {
    id: 'appLabSettings.boardExtensions.carrierDescription',
    defaultMessage:
      'Select which peripheral you are connecting to the carrier.',
    description: 'Label for the carrier description in the settings page',
  },
  carrierDescriptionVentunoQ: {
    id: 'appLabSettings.boardExtensions.carrierDescriptionVentunoQ',
    defaultMessage:
      'Select which peripheral you are connecting to the carrier. A DSI display disables CSI 0 on the board, and the other two CSI ports work either on the carrier or on the board, not both.',
    description: 'Label for the carrier description in the settings page',
  },
  carrierTypeNoOption: {
    id: 'appLabSettings.boardExtensions.carrierTypeNoOption',
    defaultMessage: 'No {type}',
    description:
      'Message indicating that no carrier is connected in the settings page',
  },
  carrierTooltip: {
    id: 'appLabSettings.boardExtensions.carrierTooltip',
    defaultMessage:
      "If you connect a display, the USB-C video port will be deactivated. This means that after restarting, the USB-C port won't work for video anymore, as long as the display port is properly set up.",
    description:
      'Tooltip providing information about carriers in the settings page',
  },
  hatTitle: {
    id: 'appLabSettings.boardExtensions.hatTitle',
    defaultMessage: 'Add-ons connected to JHat header',
    description: 'Title for the hats section in the settings page',
  },
  hatButton: {
    id: 'appLabSettings.boardExtensions.hatButton',
    defaultMessage: 'How to attach an Hat',
    description: 'Label for the hat button in the settings page',
  },
  hatType: {
    id: 'appLabSettings.boardExtensions.hatType',
    defaultMessage: 'Add-on type',
    description: 'Label for the hat type in the settings page',
  },
  hatTypePlaceholder: {
    id: 'appLabSettings.boardExtensions.hatTypePlaceholder',
    defaultMessage: 'No add-on',
    description: 'Placeholder for the hat type dropdown in the settings page',
  },
  hatTooltip: {
    id: 'appLabSettings.boardExtensions.hatTooltip',
    defaultMessage: 'Only add-ons that need to be declared are listed here.',
    description:
      'Tooltip providing information about hats in the settings page',
  },
  applyInfo: {
    id: 'appLabSettings.boardExtensions.applyInfo',
    defaultMessage:
      'Restart the board to have your extensions managed properly',
    description:
      'Message providing information about carriers in the settings page',
  },
  applyButton: {
    id: 'appLabSettings.boardExtensions.applyButton',
    defaultMessage: 'Reboot and apply',
    description: 'Button text to restart the board after enabling a carrier',
  },
});

export const csiCameraMessages = defineMessages({
  title: {
    id: 'appLabSettings.csiCamera.title',
    defaultMessage: 'CSI Camera',
    description: 'Title for the CSI camera section in the settings page',
  },
  description: {
    id: 'appLabSettings.csiCamera.description',
    defaultMessage: 'Manually install cam-server to use CSI camera on Ubuntu',
    description: 'Label for the connect camera row in the settings page',
  },
  link: {
    id: 'appLabSettings.csiCamera.link',
    defaultMessage: 'Open setup guide',
    description: 'Link text to open setup guide for the CSI camera on Ubuntu',
  },
});

export const systemMessages = defineMessages({
  title: {
    id: 'appLabSettings.system.title',
    defaultMessage: 'System info',
    description: 'Title for the system info section',
  },
  systemVersion: {
    id: 'appLabSettings.system.systemVersion',
    defaultMessage: 'System version',
    description: 'Label for the system version row',
  },
  systemVersionInfo: {
    id: 'appLabSettings.system.systemVersionInfo',
    defaultMessage:
      'The system version includes App Lab, Arduino CLI, and other core software running on the board.',
    description: 'Message showing the current system version',
  },
  systemVersionUpToDate: {
    id: 'appLabSettings.system.systemVersionUpToDate',
    defaultMessage: 'System is up to date',
    description: 'Message indicating that the system is up to date',
  },
  systemVersionUpdateAvailable: {
    id: 'appLabSettings.system.systemVersionUpdateAvailable',
    defaultMessage: 'Update',
    description: 'Message indicating that a system update is available',
  },
  releaseNotes: {
    id: 'appLabSettings.system.releaseNotes',
    defaultMessage: 'Release notes',
    description: 'Label for the release notes row',
  },
  viewReleaseNotes: {
    id: 'appLabSettings.system.viewReleaseNotes',
    defaultMessage: 'View release notes',
    description: 'Link text to view release notes',
  },
  keyboardLanguage: {
    id: 'appLabSettings.system.keyboardLanguage',
    defaultMessage: 'Keyboard language',
    description: 'Label for the keyboard language row',
  },
  terminal: {
    id: 'appLabSettings.system.terminal',
    defaultMessage: 'Terminal',
    description: 'Label for the terminal emulator row',
  },
  terminalInfo: {
    id: 'appLabSettings.system.terminalInfo',
    defaultMessage:
      'The terminal emulator used to open the shell of the board. It is detected automatically when it is not set.',
    description: 'Message explaining how the terminal emulator is selected',
  },
  terminalSection: {
    id: 'appLabSettings.system.terminalSection',
    defaultMessage: 'Terminal emulators',
    description:
      'Title of the section listing the available terminal emulators',
  },
  terminalAutomatic: {
    id: 'appLabSettings.system.terminalAutomatic',
    defaultMessage: 'Automatic',
    description:
      'Label of the option that detects the terminal emulator automatically',
  },
  terminalCustom: {
    id: 'appLabSettings.system.terminalCustom',
    defaultMessage: 'Custom…',
    description: 'Label of the option to use a custom terminal command',
  },
  terminalCustomLabel: {
    id: 'appLabSettings.system.terminalCustomLabel',
    defaultMessage: 'Custom ({command})',
    description: 'Label of the selected custom terminal command',
  },
  terminalNotInstalled: {
    id: 'appLabSettings.system.terminalNotInstalled',
    defaultMessage: '{terminal} (not installed)',
    description: 'Label of a terminal that is selected but not installed',
  },
  terminalCustomPlaceholder: {
    id: 'appLabSettings.system.terminalCustomPlaceholder',
    defaultMessage: 'e.g. alacritty',
    description: 'Placeholder of the custom terminal command input',
  },
  terminalCustomInfo: {
    id: 'appLabSettings.system.terminalCustomInfo',
    defaultMessage:
      'The command is executed with the permissions of the user running App Lab.',
    description: 'Warning shown under the custom terminal command field',
  },
  terminalCustomSave: {
    id: 'appLabSettings.system.terminalCustomSave',
    defaultMessage: 'Save',
    description: 'Button text to save the custom terminal command',
  },
  terminalCustomCancel: {
    id: 'appLabSettings.system.terminalCustomCancel',
    defaultMessage: 'Cancel',
    description: 'Button text to discard the custom terminal command',
  },
  osPassword: {
    id: 'appLabSettings.system.osPassword',
    defaultMessage: 'OS password',
    description: 'Label for the OS password row',
  },
  changePassword: {
    id: 'appLabSettings.system.changePassword',
    defaultMessage: 'Change password',
    description: 'Button text to change the OS password',
  },
  remoteAccess: {
    id: 'appLabSettings.system.remoteAccess',
    defaultMessage: 'Remote access (SSH)',
    description: 'Label for the remote access row',
  },
  remoteAccessInfo: {
    id: 'appLabSettings.system.remoteAccessInfo',
    defaultMessage:
      'Secure remote access to your board’s Linux system. Required to connect to App Lab over the network.',
    description: 'Message providing information about remote access',
  },
});

export const osMessages = defineMessages({
  title: {
    id: 'appLabSettings.os.title',
    defaultMessage: 'Operating system',
    description: 'Title for the OS image section',
  },
  osBoardSoftwareBehind: {
    id: 'appLabSettings.os.osBoardSoftwareBehind',
    defaultMessage: 'Your board software is a bit behind',
    description: 'Warning message when the board software is outdated',
  },
  updateNow: {
    id: 'appLabSettings.os.updateNow',
    defaultMessage: 'Update now',
    description: 'Button text to update the board software',
  },
  buildVersion: {
    id: 'appLabSettings.os.buildVersion',
    defaultMessage: 'Build version',
    description: 'Label for the build version row',
  },
  linuxDistribution: {
    id: 'appLabSettings.os.linuxDistribution',
    defaultMessage: 'Linux distribution',
    description: 'Label for the Linux distribution row',
  },
  kernelVersion: {
    id: 'appLabSettings.os.kernelVersion',
    defaultMessage: 'Kernel version',
    description: 'Label for the kernel version row',
  },
  releaseDate: {
    id: 'appLabSettings.os.releaseDate',
    defaultMessage: 'Release date',
    description: 'Label for the release date row',
  },
  installOsImage: {
    id: 'appLabSettings.os.installOsImage',
    defaultMessage: 'Install another OS version (flash)',
    description: 'Label to install a different OS image or reset the board',
  },
  installOsImageInfo: {
    id: 'appLabSettings.os.installOsImageInfo',
    defaultMessage:
      'Reinstall your current OS or roll back to a previous build. You can choose to keep your personal data or perform a complete wipe.',
    description:
      'Message providing information about installing a different OS image',
  },
  flashBoard: {
    id: 'appLabSettings.os.flashBoard',
    defaultMessage: 'Flash board',
    description: 'Button text to flash the board with a new OS image',
  },
});

export const networkMessages = defineMessages({
  title: {
    id: 'appLabSettings.network.title',
    defaultMessage: 'Network connections',
    description: 'Title for the network connections section',
  },
  ssid: {
    id: 'appLabSettings.network.ssid',
    defaultMessage: 'SSID',
    description: 'Label for the SSID row',
  },
  changeNetwork: {
    id: 'appLabSettings.network.changeNetwork',
    defaultMessage: 'Change network',
    description: 'Button text to change the network',
  },
  ip: {
    id: 'appLabSettings.network.ip',
    defaultMessage: 'IP',
    description: 'Label for the IP address row',
  },
  connected: {
    id: 'appLabSettings.network.connected',
    defaultMessage: 'Connected',
    description: 'Message indicating that the device is connected to a network',
  },
  noNetworkConnected: {
    id: 'appLabSettings.network.noNetworkConnected',
    defaultMessage: 'No network connected',
    description: 'Message indicating that there is no network connected',
  },
});

export const cloudConnectorMessages = defineMessages({
  title: {
    id: 'appLabSettings.cloudConnector.title',
    defaultMessage: 'Arduino App-Cloud connector',
    description: 'Title for the App Cloud section',
  },
  connectTitle: {
    id: 'appLabSettings.cloudConnector.connectTitle',
    defaultMessage: 'Connect your device to Arduino Cloud',
    description: 'Subtitle for the App Cloud section',
  },
  connectDescription: {
    id: 'appLabSettings.cloudConnector.connectDescription',
    defaultMessage: 'Manage your device on Arduino Cloud',
    description: 'Subtitle for the App Cloud section',
  },
  moreInfoButton: {
    id: 'appLabSettings.cloudConnector.moreInfoButton',
    defaultMessage: 'More info',
    description: 'Button text to get more information about the App Cloud',
  },
  connectAction: {
    id: 'appLabSettings.cloudConnector.connectAction',
    defaultMessage: 'Connect device',
    description: 'Button text to register for the App Cloud',
  },
  connectingTitle: {
    id: 'appLabSettings.cloudConnector.connectingTitle',
    defaultMessage: 'Connecting device to Arduino Cloud',
    description: 'Subtitle for the App Cloud section when connecting',
  },
  connectingDescription: {
    id: 'appLabSettings.cloudConnector.connectingDescription',
    defaultMessage:
      "Your device is connecting to the Cloud. We'll notify you when it's done.",
    description: 'Subtitle for the App Cloud section when connecting',
  },
  connectedTitle: {
    id: 'appLabSettings.cloudConnector.connectedTitle',
    defaultMessage: 'Device Arduino Cloud status',
    description: 'Subtitle for the App Cloud section when connected',
  },
  connectedDescription: {
    id: 'appLabSettings.cloudConnector.connectedDescription',
    defaultMessage: 'Manage your device on Arduino Cloud.',
    description: 'Subtitle for the App Cloud section when connected',
  },
  connectedBadge: {
    id: 'appLabSettings.cloudConnector.connected',
    defaultMessage: 'Connected',
    description:
      'Message indicating that the device is connected to the App Cloud',
  },
  openArduinoCloudButton: {
    id: 'appLabSettings.cloudConnector.openArduinoCloudButton',
    defaultMessage: 'Open Arduino Cloud',
    description:
      'Button text to open the Arduino Cloud dashboard for the connected device',
  },
  disconnectTitle: {
    id: 'appLabSettings.cloudConnector.disconnectTitle',
    defaultMessage: 'Delete device',
    description: 'Button text to disconnect from the App Cloud',
  },
  disconnectAction: {
    id: 'appLabSettings.cloudConnector.disconnectAction',
    defaultMessage: 'Delete this device',
    description: 'Button text to confirm disconnection from the App Cloud',
  },
  disconnectingTitle: {
    id: 'appLabSettings.cloudConnector.disconnectingTitle',
    defaultMessage: 'Deleting device from Arduino Cloud',
    description: 'Subtitle for the App Cloud section when disconnecting',
  },
  disconnectingDescription: {
    id: 'appLabSettings.cloudConnector.disconnectingDescription',
    defaultMessage:
      "Your device is being deleted from the Cloud. We'll notify you when it's done.",
    description: 'Subtitle for the App Cloud section when disconnecting',
  },
});

export const settingsMessages = defineMessages({
  copyright: {
    id: 'appLabSettings.copyright',
    defaultMessage:
      'Copyright (C) Arduino s.r.l. and/or its affiliated companies.',
    description: 'Copyright message in the settings page footer',
  },
});
