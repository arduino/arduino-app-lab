import { FileNameValidation } from '@cloud-editor-mono/ui-components';
import { defineMessages } from 'react-intl';

export const messages = defineMessages({
  noAgentAdvisoryTitle: {
    id: 'toolbar.agent-down-title',
    defaultMessage: 'No Cloud Agent Connection',
    description:
      'Title for advisory given to user when create agent is not detected',
  },
  noAgentAdvisoryMessage: {
    id: 'toolbar.agent-down',
    defaultMessage:
      'To upload a Sketch via USB port, make sure the Cloud Agent is installed and running on this computer.',
    description: 'Advisory given to user when create agent is not detected',
  },
  uploadNotAvailableAdvisoryTitle: {
    id: 'toolbar.generic-upload-unavailable-title',
    defaultMessage: 'Upload Unavailable',
    description:
      'Title for advisory given to user when upload is not available',
  },
  noDeviceAdvisoryTitle: {
    id: 'toolbar.no-device-upload-unavailable-title',
    defaultMessage: 'Device not found',
    description:
      'Title for advisory given to user when upload is not available because no device/port is selected',
  },
  noDeviceAdvisoryMessage: {
    id: 'toolbar.no-device-upload-unavailable',
    defaultMessage: 'To upload your sketch, plug a device.',
    description:
      'Advisory given to user when upload is not available because no device/port is selected',
  },
  successfulCreation: {
    id: 'create-file-success',
    defaultMessage: 'File successfully created',
    description: 'Advisory given to user when file is created',
  },
  successfulSketchRename: {
    id: 'rename-sketch-success',
    defaultMessage: 'Sketch successfully renamed',
    description: 'Advisory given to user when file is renamed',
  },
  sketchNameAlreadyExists: {
    id: 'rename-sketch-conflict',
    defaultMessage: 'Sketch name already exists',
    description:
      'Advisory given when to user when selected sketch name already exists',
  },
  successfulRename: {
    id: 'rename-file-success',
    defaultMessage: 'File successfully renamed',
    description: 'Advisory given to user when file is renamed',
  },
  successfulDeletion: {
    id: 'delete-file-success',
    defaultMessage: 'File successfully deleted',
    description: 'Advisory given to user when file is deleted',
  },
  portOfflineAdvisoryTitle: {
    id: 'port-offline-title',
    defaultMessage: 'Port Offline',
    description: 'Title for advisory given to user when port is offline',
  },
  portOfflineAdvisoryMessage: {
    id: 'port-offline',
    defaultMessage:
      'Your device is not online, check it is powered on, and connected to the relevant network',
    description: 'Advisory given to user when port is offline',
  },
  compileLimitExceededAdvisoryTitle: {
    id: 'compile-limit-exceeded-title',
    defaultMessage: 'Plan limits reached',
    description:
      'Title for advisory given to user when compile limit is exceeded',
  },
  compileLimitExceededAdvisory: {
    id: 'compile-limit-exceeded',
    defaultMessage:
      'You have used up your available {messageBold}. Upgrade your plan for unlimited compilations.',
    description: 'Advisory given to user when compile limit is exceeded',
  },
  compileLimitExceededAdvisoryWOUpgrade: {
    id: 'compile-limit-exceeded',
    defaultMessage: 'You have used up your available {messageBold}',
    description: 'Advisory given to user when compile limit is exceeded',
  },
  compileLimitExceededAdvisoryBold: {
    id: 'compile-limit-exceeded-bold',
    defaultMessage: '25 daily compilations',
    description: 'Bold message shown in compile limit exceeded advisory',
  },
  compileLimitExceededUpgrade: {
    id: 'compile-limit-exceeded-action',
    defaultMessage: 'Upgrade plan',
    description: 'Action given to user when compile limit is exceeded',
  },
  libraryUploadSuccess: {
    id: 'library-upload-success',
    defaultMessage: 'Library uploaded successfully',
    description: 'Advisory given to user when library is uploaded',
  },
  libraryMalformedError: {
    id: 'library-malformed-error',
    defaultMessage:
      '{hasErrorMessage, select, true {Selected file is not a valid library: {errorMessage}} other {Selected file is not a valid library}}',
    description: 'Advisory given to user when library is malformed',
  },
  libraryDownloadStart: {
    id: 'library-download-start',
    defaultMessage:
      'Preparing "{name}.zip" library, download will start shortly...',
    description: 'Advisory given to user when library download starts',
  },
  readOnlyOpenInEditor: {
    id: 'read-only-open-in-editor',
    defaultMessage: 'Open in editor',
    description: 'Action given to user when file is read-only',
  },
  readOnlyAddToSketches: {
    id: 'read-only-add-to-sketches',
    defaultMessage: 'Add to sketches',
    description: 'Action given to user when file is read-only',
  },
  readOnlyDownloadAction: {
    id: 'read-only-download',
    defaultMessage: 'Download',
    description: 'Action given to user when file is read-only',
  },
  sketchDataNotCompliantAdvisoryTitle: {
    id: 'sketch-data-not-compliant-title',
    defaultMessage: 'Sketch Data Incomplete',
    description:
      'Title for advisory given to user when sketch data is not compliant',
  },
  sketchDataNotCompliantAdvisoryMessage: {
    id: 'sketch-data-not-compliant',
    defaultMessage:
      'Data in this sketch is either loading, or not compliant with our Cloud CLI, if this message persists please see our:',
    description: 'Advisory given to user when sketch data is not compliant',
  },
  sketchDataNotCompliantReferenceLink: {
    id: 'sketch-data-not-compliant-reference-link',
    defaultMessage: 'Arduino Sketch Specification',
    description: 'Link to the Arduino Sketch Specification',
  },
  iotWebSerialWrongDevice: {
    id: 'iot-web-serial-wrong-device',
    defaultMessage: `Selected board doesn't match the device associated with this Thing`,
    description:
      'Advisory given to user when user selects a different board from the associated Thing one using the Chrome web serial selector',
  },
  otaBlockedAdvisoryTitle: {
    id: 'ota-blocked-title',
    defaultMessage: 'Upgrade for OTA upload',
    description: 'Title for advisory given to user when OTA is blocked',
  },
  otaBlockedAdvisoryMessage: {
    id: 'ota-blocked',
    defaultMessage: 'OTA upload is not available with your current plan',
    description: 'Advisory given to user when OTA is blocked',
  },
  otaBlockedAdvisoryMessageWOPlan: {
    id: 'ota-blocked',
    defaultMessage: 'OTA upload is not available',
    description: 'Advisory given to user when OTA is blocked',
  },
  otaIncompatibleTitle: {
    id: 'ota-incompatible-title',
    defaultMessage: 'OTA upload not supported',
    description:
      'Title for advisory given to user when OTA is not supported for current device',
  },
  otaIncompatibleMessage: {
    id: 'ota-incompatible',
    defaultMessage:
      'Upload Over-The-Air is not supported by this device. Please connect the device via USB.',
    description:
      'Advisory given to user when OTA is not supported for current device',
  },
  portBusyAdvisoryTitle: {
    id: 'port-busy-title',
    defaultMessage: 'Port Busy',
    description: 'Title for advisory given to user when port is busy',
  },
  portBusyAdvisoryMessage: {
    id: 'port-busy',
    defaultMessage: 'The selected port is busy, please wait a few moments',
    description: 'Advisory given to user when port is busy',
  },
  shareSketchWarning: {
    id: 'share-sketch-warning',
    defaultMessage:
      'The Sketch is now public. People outside your space with the link can view it.',
    description: 'Warning shown when user tries to share a sketch',
  },
  shareSketchUndo: {
    id: 'share-sketch-undo',
    defaultMessage: 'Undo',
    description: 'Action given to user when sketch is shared',
  },
  shareToClassroomTitle: {
    id: 'share-to-classroom-title',
    defaultMessage: 'Arduino Sketch - {title}',
    description: 'Title shown in the title of sketch shared to classroom',
  },
  shareToClassroomContent: {
    id: 'share-to-classroom-content',
    defaultMessage:
      'Hi! This is the sketch that I’ve made for you. Copy it in your sketchbook or download it.',
    description: 'Text shown in the content of sketch shared to classroom',
  },
  couldNotCheckOtaTitle: {
    id: 'could-not-check-ota-title',
    defaultMessage: 'OTA Status unknown',
    description: 'Title shown when OTA compatibility check fails',
  },
  couldNotCheckOta: {
    id: 'could-not-check-ota',
    defaultMessage: 'An Over-The-Air upload may be in progress',
    description: 'Advisory given to user when OTA compatibility check fails',
  },
  noDeviceAssociatedTitle: {
    id: 'no-device-associated-title',
    defaultMessage: 'No device associated',
    description: 'Title shown when no device is associated',
  },
  noDeviceAssociated: {
    id: 'no-device-associated',
    defaultMessage:
      'We could not find a device associated with this sketch, you can associate a device from the setup tab',
    description: 'Advisory given to user when no device is associated',
  },
  notificationPreVerifyInterrupt: {
    id: 'pre-verify-interrupt',
    defaultMessage: 'Verification requirements not meet, please retry',
    description:
      'Warning given to the user when pre-verification is interrupted',
  },
});

export const invalidFileNameMessages = defineMessages<FileNameValidation>({
  [FileNameValidation.exceedsLimit]: {
    id: 'fileNameExceedsLimit',
    defaultMessage: 'Character limit reached.',
    description: 'Character limit reached.',
  },
  [FileNameValidation.hasInvalidCharacters]: {
    id: 'fileNameContainsInvalidCharacters',
    defaultMessage:
      'Spaces, punctuations and special characters are not allowed.',
    description: 'Spaces, punctuations and special characters are not allowed.',
  },
  [FileNameValidation.alreadyExists]: {
    id: 'fileNameAlreadyExists',
    defaultMessage: 'Name already in use, please choose another one.',
    description: 'Name already in use, please choose another one.',
  },
  [FileNameValidation.emptyName]: {
    id: 'fileNameEmpty',
    defaultMessage: 'Name cannot be empty.',
    description: 'Name cannot be empty.',
  },
});
