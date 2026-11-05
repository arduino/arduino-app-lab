import { defineMessages } from 'react-intl';

export const updaterMessages = defineMessages({
  appUpdateFailed: {
    id: 'updaterContext.appUpdateFailed',
    defaultMessage: 'App Lab update failed',
    description:
      'Line in the update dialog log when the App Lab update fails without a reported reason',
  },
  appUpdateFailedWithReason: {
    id: 'updaterContext.appUpdateFailedWithReason',
    defaultMessage: 'App Lab update failed: {reason}',
    description:
      'Line in the update dialog log when the App Lab update fails. {reason} is the error text from the App Lab backend, in English',
  },
  appUpdateAlreadyRunning: {
    id: 'updaterContext.appUpdateAlreadyRunning',
    defaultMessage:
      'An App Lab update is already running. App Lab restarts when it finishes. Wait before you retry or quit App Lab.',
    description:
      'Line in the update dialog log when the App Lab backend refuses an update because an earlier one is still running, for example after the page reloaded',
  },
});
