import { defineMessages } from 'react-intl';

export const messages = defineMessages({
  title: {
    id: 'consolePanel.status.title',
    defaultMessage: 'Console',
    description: 'Title of the console panel',
  },
  verifyTimeout: {
    id: 'verify-timeout',
    defaultMessage:
      'We are still verifying your sketch, thanks for your patience',
    description: 'The current compile is taking longer than usual.',
  },
  statusVerifying: {
    id: 'consolePanel.status.verifying',
    defaultMessage: 'Verifying',
    description: 'Status text of the console panel when verifying',
  },
  statusUploading: {
    id: 'consolePanel.status.uploading',
    defaultMessage: 'Uploading',
    description: 'Status text of the console panel when uploading',
  },
  statusAvailable: {
    id: 'consolePanel.status.available',
    defaultMessage: '- Initializing Over-The-Air update...',
    description: 'Status text of the console panel when Over-The-Air is',
  },
  statusStart: {
    id: 'consolePanel.status.uploading',
    defaultMessage: '- Starting Over-The-Air update attempt...',
    description: 'Status text of the console panel when Over-The-Air is',
  },
  statusFetch: {
    id: 'consolePanel.status.uploading',
    defaultMessage: '- Uploading binary file to the board...',
    description: 'Status text of the console panel when Over-The-Air is',
  },
  statusFlash: {
    id: 'consolePanel.status.uploading',
    defaultMessage: '- Flashing binary file on the board...',
    description: 'Status text of the console panel when Over-The-Air is',
  },
  statusReboot: {
    id: 'consolePanel.status.uploading',
    defaultMessage: '- Rebooting the device...',
    description: 'Status text of the console panel when Over-The-Air is',
  },
  statusFail: {
    id: 'consolePanel.status.fail',
    defaultMessage: 'Over-The-Air update failed',
    description:
      'Status text of the console panel when Over-The-Air has failed',
  },
  statusVerifySuccess: {
    id: 'consolePanel.status.verifySuccess',
    defaultMessage: 'Done Verifying {sketchName}',
    description: 'Status text of the console panel when verifies successfully',
  },
  statusUploadSuccess: {
    id: 'consolePanel.status.uploadSuccess',
    defaultMessage: 'Done Uploading {sketchName}',
    description: 'Status text of the console panel when uploads successfully',
  },
  statusVerifyError: {
    id: 'consolePanel.status.verifyError',
    defaultMessage: 'Error Verifying {sketchName}',
    description:
      'Status text of the console panel when verifies unsuccessfully',
  },
  statusUploadError: {
    id: 'consolePanel.status.uploadError',
    defaultMessage: 'Error Uploading {sketchName}',
    description: 'Status text of the console panel when uploads unsuccessfully',
  },
  showPanelButton: {
    id: 'consolePanel.status.show',
    defaultMessage: 'Show console panel',
    description: 'Button text to show the console panel',
  },
  hidePanelButton: {
    id: 'consolePanel.status.hide',
    defaultMessage: 'Hide console panel',
    description: 'Button text to hide the console panel',
  },
  copyButtonInitial: {
    id: 'consolePanel.copyTooltip.initial',
    defaultMessage: 'Copy Console Output',
    description: 'Tooltip text for copy console output button',
  },
  copyButtonClicked: {
    id: 'consolePanel.copyTooltip.copied',
    defaultMessage: 'Copied',
    description: 'Tooltip text for copy console output button when pressed',
  },
  copyButtonError: {
    id: 'consolePanel.copyTooltip.error',
    defaultMessage: 'Error',
    description: 'Tooltip text for copy console output button when error',
  },
  pendingOta: {
    id: 'consolePanel.status.pendingOta',
    defaultMessage:
      '- Scheduled upload, waiting for the device to reconnect...',
    description: 'Status text of the console panel to inform an OTA is pending',
  },
  fixErrors: {
    id: 'consolePanel.status.fixErrors',
    defaultMessage: 'Fix Errors',
    description: 'Button text to fix error',
  },
  fixThisError: {
    id: 'consolePanel.status.fixThisError',
    defaultMessage: 'Fix this error: {compileResultMessages}',
    description: 'Button text to fix this error with AI',
  },
  planLimitsReachedTitle: {
    id: 'consolePanel.status.planLimitsReachedTitle',
    defaultMessage: 'Plan limits reached',
    description: 'Title for the plan limits reached message',
  },
  plan1500LimitsReachedContent: {
    id: 'consolePanel.status.plan1500LimitsReachedContent',
    defaultMessage:
      'You’ve reached your daily limit of {limit1500messages} Wait until next month to reset your usage, or you can upgrade your plan to {unlockUnlimitedAccess}',
    description: 'Content for the plan limit reached message',
  },
  plan50LimitsReachedContent: {
    id: 'consolePanel.status.plan50LimitsReachedContent',
    defaultMessage:
      'You’ve reached your daily limit of {limit50Messages} Upgrade your plan to unlock 1500 messages per month.',
    description: 'Content for the plan limit reached message',
  },
  limit50messages: {
    id: 'consolePanel.status.limit50messages',
    defaultMessage: '50 monthly AI messages.',
    description: 'Content for the plan limit reached message',
  },
  limit1500messages: {
    id: 'consolePanel.status.limit1500messages',
    defaultMessage: '1500 AI monthly messages.',
    description: 'Content for the plan limit reached message',
  },
  unlockUnlimitedAccess: {
    id: 'consolePanel.status.unlockUnlimitedAccess',
    defaultMessage: 'unlock unlimited access.',
    description: 'Link to upgrade the plan',
  },
  planLimitsReachedLink: {
    id: 'consolePanel.status.planLimitsReachedLink',
    defaultMessage: 'Upgrade plan',
    description: 'Link to upgrade the plan',
  },
});
