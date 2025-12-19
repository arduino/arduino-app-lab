import { defineMessages } from 'react-intl';

export const messages = defineMessages({
  // Titles
  titleCheckingForUpdates: {
    id: 'app-lab.board-update-dialog.checking-for-updates-title',
    defaultMessage: 'Checking for updates',
    description:
      'Title shown on the board update dialog when checking for updates',
  },
  titleUpdatesAvailable: {
    id: 'app-lab.board-update-dialog.updates-available',
    defaultMessage: 'Updates available',
    description: 'Title shown when updates are available',
  },
  titleInstallingUpdates: {
    id: 'app-lab.board-update-dialog.installing-updates',
    defaultMessage: 'Installing updates...',
    description: 'Title shown when installing updates',
  },
  titleUpdates: {
    id: 'app-lab.board-update-dialog.updates',
    defaultMessage: 'Updates',
    description: 'Title shown on the board update dialog for updates',
  },

  // Buttons
  installUpdate: {
    id: 'app-lab.board-update-dialog.install-update',
    defaultMessage: 'Install Updates',
    description: 'Button text to install the available update',
  },
  skipUpdate: {
    id: 'app-lab.board-update-dialog.skip-update',
    defaultMessage: 'Next Time',
    description: 'Button text to skip the update and close the dialog',
  },
  retry: {
    id: 'app-lab.board-update-dialog.retry',
    defaultMessage: 'Retry',
    description: 'Button text to retry checking for updates',
  },
  restart: {
    id: 'app-lab.board-update-dialog.restart',
    defaultMessage: 'Restart App Lab',
    description: 'Button text to restart the app lab after update',
  },

  // Status messages
  checkingForUpdates: {
    id: 'app-lab.board-update-dialog.checking-for-updates',
    defaultMessage: 'We are checking for updates',
    description: 'Status text shown when the updater is checking for updates',
  },
  onlyMoment: {
    id: 'app-lab.board-update-dialog.only-moment',
    defaultMessage: 'This will only take a moment, thank you for your patience',
    description: 'Additional info text shown when checking for updates',
  },

  // Error states
  updateFailed: {
    id: 'app-lab.board-update-dialog.update-failed',
    defaultMessage: 'Update failed',
    description: 'Status text shown when the update has failed',
  },
  updateFailedDescription: {
    id: 'app-lab.board-update-dialog.update-failed-description',
    defaultMessage:
      'If problem persists try flashing the latest OS image using',
    description: 'Description text for update failure',
  },
  arduinoFlasherTool: {
    id: 'app-lab.board-update-dialog.arduino-flasher-tool',
    defaultMessage: 'Arduino Flasher Tool',
    description: 'Link text for Arduino Flasher Tool',
  },
  orContact: {
    id: 'app-lab.board-update-dialog.or-contact',
    defaultMessage: 'or contact',
    description: 'Text between flasher tool and support links',
  },
  arduinoSupport: {
    id: 'app-lab.board-update-dialog.arduino-support',
    defaultMessage: 'Arduino Support.',
    description: 'Link text for Arduino Support',
  },
  errorEncountered: {
    id: 'app-lab.board-update-dialog.error-encountered',
    defaultMessage:
      'Updates were applied successfully, but we encountered some errors',
    description:
      'Text shown when errors were encountered during the update process',
  },

  // Update labels
  unoQSoftwareUpdate: {
    id: 'app-lab.board-update-dialog.uno-q-software-update',
    defaultMessage: 'UNO Q software update',
    description: 'Label for UNO Q software update section',
  },
  arduinoAppLab: {
    id: 'app-lab.board-update-dialog.arduino-app-lab',
    defaultMessage: 'Arduino App Lab (on PC)',
    description: 'Label for Arduino App Lab update section',
  },
  version: {
    id: 'app-lab.board-update-dialog.version',
    defaultMessage: 'Version',
    description: 'Version label prefix',
  },
  installing: {
    id: 'app-lab.board-update-dialog.installing',
    defaultMessage: 'Installing',
    description: 'Status text shown when installing',
  },
  installed: {
    id: 'app-lab.board-update-dialog.installed',
    defaultMessage: 'Installed',
    description: 'Status text shown when installation is complete',
  },

  // Notes
  sbcRestartNote: {
    id: 'app-lab.board-update-dialog.sbc-restart-note',
    defaultMessage: 'Please close and reopen App Lab',
    description: 'Note shown for SBC users to manually restart the app',
  },
});
