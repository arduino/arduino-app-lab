import { defineMessages } from 'react-intl';

export const messages = defineMessages({
  title: {
    id: 'app-lab.board-update-dialog.title',
    defaultMessage: "What's new",
    description: 'Title shown on the board update dialog for updates',
  },

  // Buttons
  showDetails: {
    id: 'app-lab.board-update-dialog.show-details',
    defaultMessage: 'Show update details',
    description: 'Button text to show update details',
  },
  hideDetails: {
    id: 'app-lab.board-update-dialog.hide-details',
    defaultMessage: 'Hide update details',
    description: 'Button text to hide update details',
  },
  installUpdate: {
    id: 'app-lab.board-update-dialog.install-update',
    defaultMessage: 'Install updates',
    description: 'Button text to install the available update',
  },
  skipUpdate: {
    id: 'app-lab.board-update-dialog.skip-update',
    defaultMessage: 'Skip',
    description: 'Button text to skip the update and close the dialog',
  },
  changeNetwork: {
    id: 'app-lab.board-update-dialog.change-network',
    defaultMessage: 'Change Network',
    description: 'Button text to change network settings to allow update check',
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

  // Checking messages
  checkingForUpdates: {
    id: 'app-lab.board-update-dialog.checking-for-updates',
    defaultMessage: 'Looking for updates...',
    description: 'Status text shown when the updater is checking for updates',
  },
  checkingForUpdatesDescription: {
    id: 'app-lab.board-update-dialog.checking-for-updates-description',
    defaultMessage: 'Gathering fresh system bit. Almost there!',
    description: 'Additional info text shown when checking for updates',
  },
  checkingFailed: {
    id: 'app-lab.board-update-dialog.checking-failed',
    defaultMessage: 'Update failed',
    description: 'Status text shown when the update has failed',
  },
  checkingFailedDescription: {
    id: 'app-lab.board-update-dialog.checking-failed-description',
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

  // Update states
  updateInstalling: {
    id: 'app-lab.board-update-dialog.update-installing',
    defaultMessage: 'Installing updates...',
    description: 'Status text shown when the update is being installed',
  },
  updateCompleted: {
    id: 'app-lab.board-update-dialog.update-completed',
    defaultMessage: 'Update complete',
    description:
      'Status text shown when the update has been installed successfully',
  },
  updateFailed: {
    id: 'app-lab.board-update-dialog.update-failed',
    defaultMessage: 'Update failed, try again or check out error details',
    description: 'Status text shown when the update has failed',
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
});
