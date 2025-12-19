import { defineMessages } from 'react-intl';

// Define a type for the keys of the messages object
export type MessageKey = keyof typeof messages;

export const messages = defineMessages({
  notificationPendingFailed: {
    id: 'notification.pending-failed',
    defaultMessage: 'Over-the-air is already in progress, cannot abort',
    description: 'Over-the-air is already in progress, cannot abort',
  },
  notificationFailed: {
    id: 'notification.failed',
    defaultMessage: 'The request has failed, try again!',
    description: 'General failed request message',
  },
  notificationVerifyInterrupt: {
    id: 'notification.verify-interrupt',
    defaultMessage: 'Verify interrupted',
    description: 'Confirmation compile was interrupted',
  },
  notificationCompilationFailed: {
    id: 'notification.createCompilation-interrupt',
    defaultMessage: 'Error while initiating the verification, please retry.',
    description: 'Create compilation has failed',
  },
  notificationVerifyCouldNotBeInterrupted: {
    id: 'notification.verify-could-not-be-interrupted',
    defaultMessage: 'Verify could not be interrupted',
    description: 'Confirmation compile could not be interrupted',
  },
  iotUploadIsReady: {
    id: 'iot-upload-is-ready',
    defaultMessage: 'Over-The-Air upload available, compiling...',
    description: 'Advisory given to user when OTA upload is ready',
  },
  iotUploadFailedUnknownIfReady: {
    id: 'iot-upload-failed-unknown-ready',
    defaultMessage:
      'Could not determine device readiness for Over-The-Air upload',
    description: 'Advisory given to user when upload failed',
  },
  iotUploadRequestUnsuccessful: {
    id: 'iot-upload-request-failed',
    defaultMessage: 'Over-The-Air upload request was unsuccessful',
    description: 'Advisory given to user when upload failed',
  },
  iotUploadRequestSuccessful: {
    id: 'iot-upload-request-successful',
    defaultMessage: 'Over-The-Air upload request created...',
    description: 'Advisory given to user when request created successfully',
  },
  iotUploadFailed: {
    id: 'iot-upload-failed',
    defaultMessage: 'Upload Over-The-Air failed',
    description: 'Advisory given to user when upload failed',
  },
  iotUploadAborted: {
    id: 'iot-upload-aborted',
    defaultMessage: 'Upload Over-The-Air aborted',
    description: 'Advisory given to user when upload aborted',
  },
  iotUploadPending: {
    id: 'iot-upload-pending',
    defaultMessage: 'Over-The-Air upload pending...',
    description: 'Advisory given to user when upload pending',
  },
  iotUploadSuccess: {
    id: 'iot-upload-success',
    defaultMessage: 'Upload Over-The-Air succeeded',
    description: 'Advisory given to user when upload succeeded',
  },
  iotCompleted: {
    id: 'iot-completed',
    defaultMessage: 'Over-The-Air update successfully completed',
    description: 'Advisory given to user when OTA update completed',
  },
  iotUploadNinaUpdateRequired: {
    id: 'iot-upload-nina-update-required',
    defaultMessage:
      'Upload unavailable. To upload an IoT Cloud sketch, update the NINA firmware to the latest version.',
    description: 'Advisory given to user when nina update is required',
  },
  iotUploadWrongDevice: {
    id: 'iot-upload-wrong-device',
    defaultMessage:
      'Upload unavailable. The Thing associated with this sketch is not associated with the selected device',
    description: 'Advisory given to user when wrong device is selected',
  },
  iotUploadOTAUnavailable: {
    id: 'iot-upload-ota-unavailable',
    defaultMessage: `Upload Over-The-Air unavailable. Your device firmware may need updating, or there may be a problem with the sketch running on the device`,
    description: 'Advisory given to user when OTA upload is unavailable',
  },
  iotState_available: {
    id: 'iot-upload-ota-state-available',
    defaultMessage: `Initializing Over-The-Air update...`,
    description:
      'Advisory given to user when current OTA upload is available and initializing',
  },
  iotState_start: {
    id: 'iot-upload-ota-state-start',
    defaultMessage: `Starting Over-The-Air update attempt...`,
    description:
      'Advisory given to user when current OTA upload attempt is starting',
  },
  iotState_fetch: {
    id: 'iot-upload-ota-state-fetch',
    defaultMessage: `Uploading binary file to the board: `,
    description:
      'Advisory given to user when current OTA is uploading the binary file',
  },
  iotState_flash: {
    id: 'iot-upload-ota-state-flash',
    defaultMessage: `Flashing binary file to the board…`,
    description:
      'Advisory given to user when current OTA upload is flashing binary file to the board',
  },
  iotState_reboot: {
    id: 'iot-upload-ota-state-reboot',
    defaultMessage: `Rebooting the device...`,
    description:
      'Advisory given to user when current OTA upload is rebooting the device',
  },
  iotState_fail: {
    id: 'iot-upload-ota-state-fail',
    defaultMessage: `Over-The-Air update failed.`,
    description: 'Advisory given to user when current OTA upload has failed',
  },
  iotError_boardError: {
    id: 'iot-upload-ota-error-board',
    defaultMessage: `Board error received - {err}`,
    description:
      'Advisory given to user when current OTA upload has failed with board error',
  },
  iotError_Timeout: {
    id: 'iot-upload-ota-error-timeout',
    defaultMessage: `Timeout expired - Please check the board connection status and try again`,
    description:
      'Advisory given to user when current OTA upload has failed with timeout',
  },
  iotError_Sha256Mismatch: {
    id: 'iot-upload-ota-error-sha256',
    defaultMessage: `SHA256 mismatch - Unable to apply the new firmware. Previous firmware detected after restart`,
    description:
      'Advisory given to user when current OTA upload has failed with Sha256 mismatch',
  },
  iotError_Sha256Unknown: {
    id: 'iot-upload-ota-error-sha256Unknown',
    defaultMessage: `SHA256 Unknown - Unknown Firmware detected after restart.`,
    description:
      'Advisory given to user when current OTA upload has failed with Sha256 Unknown',
  },
  iotUploadOTAIncompatible: {
    id: 'iot-upload-ota-incompatible',
    defaultMessage: `Upload Over-The-Air is not supported by this device. Please connect the device via USB.`,
    description:
      'Advisory given to user when OTA upload is not supported by selected device',
  },
  iotCertCheckFailed: {
    id: 'iot-cert-check-failed',
    defaultMessage: `There was a problem updating your sketch to migrate your device certificate. Please try again.`,
    description: 'Advisory given to user when certificate check has failed',
  },
  genAIPromptToLong: {
    id: 'gen-ai-prompt-to-long',
    defaultMessage: `Your message was clipped. Max length {maxLen} characters.`,
    description: 'Advisory given to user when GenAI prompt is too long',
  },
  genAIPromptToLongError: {
    id: 'gen-ai-prompt-to-long-error',
    defaultMessage: `Could not send message. Over max length.`,
    description:
      'Advisory given to user when GenAI error occurred because prompt too long',
  },
  genAIMaxTokensReachedError: {
    id: 'gen-ai-max-tokens-reached-error',
    defaultMessage: `Max output tokens reached. The assistant answer may be incomplete.`,
    description:
      'Advisory given to user when GenAI error occurred because max output tokens reached',
  },
});
