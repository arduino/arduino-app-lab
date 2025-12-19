import { defineMessages } from 'react-intl';

export const messages = defineMessages({
  title: {
    id: 'devicesDialog.title',
    defaultMessage: 'Select device',
    description: 'Title shown in the device association dialog',
  },
  titleIdentifyUnknown: {
    id: 'devicesDialog.titleIdUnknow',
    defaultMessage: 'Unknown Device Found',
    description:
      'Title shown in the Identify Unknown device association dialog',
  },
  noDeviceTitle: {
    id: 'devicesDialog.noDevicesTitle',
    defaultMessage: 'Plug your device into your computer',
    description: 'Title shown when no connected device is found',
  },
  associatedToSketch: {
    id: 'devicesDialog.associatedToSketch',
    defaultMessage: 'This device is currently associated with the sketch',
    description:
      'Text shown when a specific device is associated to the current sketch',
  },
  readyToBeAssociated: {
    id: 'devicesDialog.readyToBeAssociated',
    defaultMessage: 'Your device {name} is ready to be associated.',
    description:
      'Text shown when a device is ready to be associated to the current sketch',
  },
  associateButton: {
    id: 'devicesDialog.associateButton',
    defaultMessage: 'Associate',
    description: 'Label for the associate button',
  },
  detachButton: {
    id: 'devicesDialog.detachButton',
    defaultMessage: 'Detach',
    description: 'Label for the detach button',
  },
  dividerLabel: {
    id: 'devicesDialog.dividerLabel',
    defaultMessage: 'or',
    description:
      'Divider label to separate manual select from detected devices',
  },
  detectedDeviceListHelper: {
    id: 'devicesDialog.detectedDeviceListHelper',
    defaultMessage:
      'Select the device you want to associate to the sketch to start coding and uploading.',
    description: 'Helper text shown when detected devices are found',
  },
  identifyDeviceTitle: {
    id: 'devicesDialog.identifyDeviceTitle',
    defaultMessage: 'Unknown device, identify its type',
    description: 'Title shown when unrecognized devices are found',
  },
  identifyDeviceHelper: {
    id: 'devicesDialog.identifyDeviceHelper',
    defaultMessage:
      'Specify the type of the device you are associating to the sketch.',
    description: 'Helper text shown when unrecognized devices are found',
  },
  selectedTypeTitle: {
    id: 'devicesDialog.selectedTypeTitle',
    defaultMessage: 'Select a device type',
    description: 'Title shown when selecting a device type',
  },
  associateToSketchHelper: {
    id: 'devicesDialog.associateToSketchHelper',
    defaultMessage:
      'Select the type of the device you are associating to the sketch.',
    description:
      'Helper text shown when selecting a device type to associate it to the sketch',
  },
  selectForUploadHelper: {
    id: 'devicesDialog.selectForUploadHelper',
    defaultMessage:
      'Choose the device type you want to verify your sketch for.',
    description:
      'Helper text shown when selecting a device type to associate it to the sketch',
  },
  noResultsTitle: {
    id: 'devicesDialog.noResults',
    defaultMessage: 'No results found',
    description: 'Text shown when no results are found',
  },
  noResultsSubtitle: {
    id: 'devicesDialog.noResultsSubtitle',
    defaultMessage: "We couldn't find any device with this name.",
    description: 'Helper text shown when no results are found',
  },
  searchBarPlaceholder: {
    id: 'devicesDialog.searchBarPlaceholder',
    defaultMessage: 'Search device type',
    description: 'Placeholder for the device type search bar',
  },
  backButton: {
    id: 'devicesDialog.backButton',
    defaultMessage: 'Back',
    description: 'Label for the back button',
  },
  closeButton: {
    id: 'devicesDialog.closeButton',
    defaultMessage: 'Close',
    description: 'Label for the close button',
  },
  manualSelectionMessage: {
    id: 'devicesDialog.manualSelectionMessage',
    defaultMessage:
      'Do you want to verify your sketch for a specific device type you don’t have at hand?',
    description: 'Message to direct users to manual selection',
  },
  manualSelectionButton: {
    id: 'devicesDialog.manualSelectionButton',
    defaultMessage: 'Select device type',
    description: 'Label for the manual selection button',
  },
  troubleshootingMessage: {
    id: 'devicesDialog.troubleshootingMessage',
    defaultMessage:
      'If your device is plugged in but it’s not getting detected, check the {troubleshootingLink}',
    description: 'Message to direct users to troubleshooting',
  },
  troubleshootingLink: {
    id: 'devicesDialog.troubleshootingLink',
    defaultMessage: 'troubleshooting',
    description: 'Label for the troubleshooting link',
  },
  agentNotFoundTitle: {
    id: 'devicesDialog.agentNotFoundTitle',
    defaultMessage: 'Arduino Cloud Agent not found',
    description:
      'Label for devices dialog when Cloud Agent is not working properly',
  },
  agentNotFoundMessage: {
    id: 'devicesDialog.agentNotFoundMessage',
    defaultMessage:
      'You need to download and install the plugin in order to upload sketches from Arduino Cloud platform to your board or device.',
    description: 'Message to direct users to agent download',
  },
  agentNotFoundDownload: {
    id: 'devicesDialog.agentNotFoundDownload',
    defaultMessage: 'Download',
    description: 'Label for agent download button',
  },
  agentNotFoundTroubleMessage: {
    id: 'devicesDialog.agentNotFoundTroubleMessage',
    defaultMessage:
      'If you have already installed the plugin but it’s not running, try restarting it. If the problem persists, check the {troubleshootingLink}',
    description: 'Message to direct users to troubleshooting',
  },
  pluginBoardPrompt: {
    id: 'devicesDialog.plugin-board-prompt',
    defaultMessage:
      "If you have your device, plug it in and it'll be recognized.",
    description: 'Prompt to user to plugin a board',
  },
  uploadPromptTitle: {
    id: 'devicesDialog.upload-prompt-title',
    defaultMessage: 'Choose a device to upload to',
    description: 'Prompt user to choose a device to upload to',
  },
  DetectedDevicesGroupLabel: {
    id: 'devicesDialog.detected-devices-tab-label',
    defaultMessage: 'Detected devices',
    description: 'Label for detected devices tab',
  },
  offlineDevicesTabLabel: {
    id: 'devicesDialog.offline-devices-tab-label',
    defaultMessage: 'Offline devices',
    description: 'Label for offline devices tab',
  },
  overTheAirDeviceLabel: {
    id: 'devicesDialog.over-the-air-device-label',
    defaultMessage: 'Over-The-Air',
    description: 'Label for over the air device',
  },
  verifyOnly: {
    id: 'devicesDialog.verify-only',
    defaultMessage: 'Verify Only',
    description: 'Label for verify only devices',
  },
  uploadNotSupported: {
    id: 'devicesDialog.upload-not-supported',
    defaultMessage: 'Upload not supported yet',
    description: 'Topltip label for upload not supported devices',
  },
});
