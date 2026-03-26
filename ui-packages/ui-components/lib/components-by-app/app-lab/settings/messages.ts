import { defineMessages } from 'react-intl';

export const appMessages = defineMessages({
  title: {
    id: 'appLabSettings.app.title',
    defaultMessage: 'Arduino App Lab',
    description: 'Title for the App Lab settings page',
  },
  appLabVersion: {
    id: 'appLabSettings.app.version',
    defaultMessage: 'App Lab Version',
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
    defaultMessage: 'Device Details',
    description: 'Title for the device details section in the settings page',
  },
  fqbn: {
    id: 'appLabSettings.section.fqbn',
    defaultMessage: 'FQBN',
    description: 'Label for the device FQBN in the settings page',
  },
  serialNumber: {
    id: 'appLabSettings.device.serialNumber',
    defaultMessage: 'Serial Number',
    description: 'Label for the device serial number in the settings page',
  },
  diskStorage: {
    id: 'appLabSettings.device.diskStorage',
    defaultMessage: 'Disk Storage',
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

export const systemMessages = defineMessages({
  title: {
    id: 'appLabSettings.system.title',
    defaultMessage: 'System Info',
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
    defaultMessage: 'Build Version',
    description: 'Label for the build version row',
  },
  linuxDistribution: {
    id: 'appLabSettings.os.linuxDistribution',
    defaultMessage: 'Linux Distribution',
    description: 'Label for the Linux distribution row',
  },
  kernelVersion: {
    id: 'appLabSettings.os.kernelVersion',
    defaultMessage: 'Kernel Version',
    description: 'Label for the kernel version row',
  },
  releaseDate: {
    id: 'appLabSettings.os.releaseDate',
    defaultMessage: 'Release date',
    description: 'Label for the release date row',
  },
  installOsImage: {
    id: 'appLabSettings.os.installOsImage',
    defaultMessage: 'Install another OS version (Flash)',
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
    defaultMessage: 'Flash Board',
    description: 'Button text to flash the board with a new OS image',
  },
});

export const networkMessages = defineMessages({
  title: {
    id: 'appLabSettings.network.title',
    defaultMessage: 'Network Connections',
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
