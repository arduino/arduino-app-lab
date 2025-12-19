import { defineMessages } from 'react-intl';

export const messages = defineMessages({
  verify: {
    id: 'toolbar.verify',
    defaultMessage: 'Verify',
    description: 'Label for the button used to verify the sketch',
  },
  pending: {
    id: 'toolbar.pending',
    defaultMessage: 'Pending...',
    description: 'Label for the button showed when the Over-The-Air is pending',
  },
  creating: {
    id: 'toolbar.creating',
    defaultMessage: 'Creating...',
    description:
      'Label for the button showed when the Over-The-Air is creating',
  },
  pend: {
    id: 'toolbar.pend',
    defaultMessage: 'Pend...',
    description: 'Label for the button showed when the Over-The-Air is pending',
  },
  verifying: {
    id: 'toolbar.verifying',
    defaultMessage: 'Verifying...',
    description:
      'Label for the button used to verify the sketch when the sketch is being verified',
  },
  verifyingShort: {
    id: 'toolbar.verifying-short',
    defaultMessage: 'Verify...',
    description:
      'Hover label for the button used to verify the sketch when the sketch is being verified',
  },
  upload: {
    id: 'toolbar.upload',
    defaultMessage: 'Upload',
    description: 'Label for the button used to upload the sketch',
  },
  uploading: {
    id: 'toolbar.uploading',
    defaultMessage: 'Uploading...',
    description:
      'Label for the button used to upload the sketch when the sketch is being uploaded',
  },
  associateDevice: {
    id: 'toolbar.associateDevice',
    defaultMessage: 'Select device',
    description:
      'Label for the button used to associate a device to the sketch',
  },
  deviceNotFoundTooltip: {
    id: 'toolbar.deviceTooltip.notFound',
    defaultMessage: 'If your device is plugged in, try to:',
    description:
      'Info text shown in the toolbar tooltip . It tells the user what to do when the device is not found',
  },
  detachDevice: {
    id: 'toolbar.deviceTooltip.detach',
    defaultMessage:
      'Detach the device from any shield/carrier or external circuitry',
    description:
      'A troubleshooting step in the toolbar tooltip. It suggests to detach the device from any external accessory',
  },
  reconnectDevice: {
    id: 'toolbar.deviceTooltip.reconnect',
    defaultMessage:
      'Reconnect the device to the computer with another USB cable and make sure the power LED lights up',
    description:
      'A troubleshooting step in the toolbar tooltip. It suggests to reconnect the device to the computer with another USB cable',
  },
  resetDevice: {
    id: 'toolbar.deviceTooltip.reset',
    defaultMessage:
      'Reset your device: quickly double press the Reset button (RST) of your board. Once reset, the LED should fade in and out.',
    description:
      'A troubleshooting step in the toolbar tooltip. It suggests to reset the device',
  },
  thirdPartyDevice: {
    id: 'toolbar.deviceTooltip.thirdParty',
    defaultMessage: '3rd party device',
    description: 'Text to indicate a third party device (not Arduino)',
  },
  unknownDevice: {
    id: 'toolbar.deviceTooltip.unknown',
    defaultMessage:
      "The device found is a {thirdPartyDeviceLabel} but we are not sure it's {article} {boardLabel}.",
    description: 'Text to indicate the presence of an unknown device',
  },
  changeDevice: {
    id: 'toolbar.changeDeviceTooltip',
    defaultMessage: 'Change Associated Device',
    description:
      'Text shown in the tooltip shown when hovering the button to change the associated device',
  },
  deviceNotFound: {
    id: 'toolbar.deviceNotFound',
    defaultMessage: 'Device not found',
    description: 'Text shown in the toolbar when the device is not connected',
  },
  noAssociatedDevice: {
    id: 'toolbar.noAssociatedDevice',
    defaultMessage: 'No associated device yet',
    description:
      'Text shown in the toolbar when a device has not been associated to an iot sketch',
  },
  serialMonitor: {
    id: 'toolbar.serialMonitor',
    defaultMessage: 'Serial Monitor',
    description:
      'Text shown in the toolbar when hovering the button to open the serial monitor',
  },
  serialPortUnavailable: {
    id: 'toolbar.serialPortUnavailable',
    defaultMessage: 'Serial port unavailable',
    description:
      'Title shown in the toolbar serial monitor button tooltip when the serial port is not available',
  },
  serialPortUnavailableDescription: {
    id: 'toolbar.serialPortTooltip.unavailable',
    defaultMessage: 'No device connected via USB.',
    description:
      'Description shown in the toolbar serial monitor button tooltip when the serial port is not available',
  },
  serialPortBusy: {
    id: 'toolbar.serialPortBusy',
    defaultMessage: 'Serial Port Busy',
    description:
      'Title shown in the toolbar serial monitor button tooltip when the serial port is busy',
  },
  serialPortBusyDescription: {
    id: 'toolbar.serialPortBusy.unavailable',
    defaultMessage: 'Please check if any other software is is using this port.',
    description:
      'Description shown in the toolbar serial monitor button tooltip when the serial port is busy',
  },
  deviceFoundTitle: {
    id: 'toolbar.device-found-title',
    defaultMessage: 'New device found',
    description: 'Shown when a single new device is available',
  },
  devicesFoundTitle: {
    id: 'toolbar.devices-found-title',
    defaultMessage: 'New devices found',
    description: 'Shown when a multiple new devices are available',
  },
  manyDevicesFoundLabel: {
    id: 'toolbar.many-matching-devices-found-label',
    defaultMessage: 'Multiple devices found',
    description:
      'Shown when a multiple devices matching selected board are available',
  },
  connectedOtaPort: {
    id: 'toolbar.connected-iot-port',
    defaultMessage: 'Over-The-Air',
    description: 'Shown when a device is connected via OTA',
  },
  offlineOtaPort: {
    id: 'toolbar.offline-iot-port',
    defaultMessage: 'Device offline',
    description: 'Shown when a device is offline via OTA',
  },
  flavourConfig: {
    id: 'toolbar.flavourConfig',
    defaultMessage: 'Configure Flavour',
    description: 'Label for the button used to open the flavour config',
  },
  shareSketch: {
    id: 'toolbar.shareSketch',
    defaultMessage: 'Share Sketch',
    description: 'Label for the button used to share the sketch',
  },
  downloadSketch: {
    id: 'toolbar.downloadSketch',
    defaultMessage: 'Download Sketch',
    description: 'Label for the button used to download the sketch',
  },
  detectDevice: {
    id: 'toolbar.detectedDevice',
    defaultMessage: 'Detect device',
    description: 'Label to the trigger the web serial detect device flow',
  },
  iotSetupTabMessage: {
    id: 'toolbar.iotSetupTabMessage',
    defaultMessage: 'Change the associated device from the {iotSetupTabLink}',
    description: 'Message to show a quick link to the setup page',
  },
  iotSetupTabLink: {
    id: 'toolbar.iotSetupTabLink',
    defaultMessage: 'Setup tab',
    description: 'Link to the setup tab',
  },
});

export const shareSketchMessages = defineMessages({
  titlePersonal: {
    id: 'shareSketch.title-personal',
    defaultMessage: 'Sketch sharing',
    description:
      'Title shown in the share sketch panel when the sketch is personal',
  },
  titleOrganization: {
    id: 'shareSketch.title-organization',
    defaultMessage: 'Public sharing',
    description:
      'Title shown in the share sketch panel when the sketch is from an organization',
  },
  publicEnabled: {
    id: 'shareSketch.public-enabled',
    defaultMessage: 'Enabled',
    description: 'Label for the public visibility option',
  },
  publicDisabled: {
    id: 'shareSketch.public-disabled',
    defaultMessage: 'Disabled',
    description: 'Label for the public visibility option',
  },
  publicLabel: {
    id: 'shareSketch.public-label',
    defaultMessage:
      'Anyone with the link can view this sketch, but they cannot edit the original.',
    description: 'Label for the public visibility option',
  },
  personalLabel: {
    id: 'shareSketch.personal-label',
    defaultMessage: 'Only you can view and edit this sketch',
    description: 'Label for the personal visibility option',
  },
  organizationLabel: {
    id: 'shareSketch.organization-label',
    defaultMessage: `Only users who have access to the shared space SHARED-SPACE-NAME can view and edit this sketch.`,
    description: 'Label for the organization visibility option',
  },
  membersUrlLabel: {
    id: 'shareSketch.members-url-label',
    defaultMessage: 'Link to share it within space members',
    description: 'Label for the members only link',
  },
  urlLabel: {
    id: 'shareSketch.url-label',
    defaultMessage: 'Link to share',
    description: 'Label for the shareable link',
  },
  embedLabel: {
    id: 'shareSketch.embed-label',
    defaultMessage: 'Embed in HTML code',
    description: 'Label for the embed string',
  },
  shareToClassroom: {
    id: 'shareSketch.share-to-classroom',
    defaultMessage: 'Share to Google Classroom',
    description: 'Label for the share to Google Classroom',
  },
});
