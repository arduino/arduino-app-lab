import { defineMessages } from 'react-intl';

export const messages = defineMessages({
  title: {
    id: 'app-lab.flasher.title',
    defaultMessage: 'Flash board',
    description: 'Title shown on the flasher page',
  },
  configurationStepTitle: {
    id: 'app-lab.flasher.configuration-step-title',
    defaultMessage: 'Configure',
    description: 'Title shown during the configuration step',
  },
  configurationStepImageVersionLabel: {
    id: 'app-lab.flasher.configuration-step-image-version-label',
    defaultMessage: 'Build Version',
    description: 'Label for the image selection field',
  },
  configurationStepImageVersionAction: {
    id: 'app-lab.flasher.configuration-step-image-version-action',
    defaultMessage: 'Change',
    description: 'Action text for selecting an image',
  },
  configurationStepPreserveDataTitle: {
    id: 'app-lab.flasher.configuration-step-preserve-data-title',
    defaultMessage: 'Data option',
    description: 'Label for the include user data checkbox',
  },
  configurationStepPreserveDataLabel: {
    id: 'app-lab.flasher.configuration-step-preserve-data-label',
    defaultMessage: 'Preserve existing data during the board flashing process',
    description: 'Label for the include user data checkbox',
  },
  configurationStepPreserveDataTooltip: {
    id: 'app-lab.flasher.configuration-step-preserve-data-tooltip',
    defaultMessage:
      'Data will be kept during the update. <bold>Turn</bold> this <bold>off</bold> if you prefer a <bold>full reset</bold>.',
    description: 'Tooltip for the include user data checkbox',
  },
  configurationStepPreserveDataWarning: {
    id: 'app-lab.flasher.configuration-step-preserve-data-warning',
    defaultMessage:
      'Please note that this update will require a <bold>complete re-initialization</bold> of your board, resulting in the <bold>loss of all current data.</bold>',
    description:
      'Warning message shown when preserving data during flashing process',
  },
  configurationStepAction: {
    id: 'app-lab.flasher.configuration-step-action',
    defaultMessage: 'Start flashing',
    description: 'Action text for starting the flashing process',
  },
  configurationStepActionInfo: {
    id: 'app-lab.flasher.configuration-step-action-label',
    defaultMessage: 'Ready to flash your board? The action can’t be stopped',
    description: 'Label beside the action button to start flashing',
  },
  configurationStepActionError: {
    id: 'app-lab.flasher.configuration-step-action-error',
    defaultMessage: 'An error occurred, please try again.',
    description: 'Error message shown when flashing process fails',
  },
  configurationStepActionWarning: {
    id: 'app-lab.flasher.configuration-step-action-warning',
    defaultMessage:
      'Not enough disk space in your computer. This update needs 10 GB. Free up some space and try again.',
    description: 'Warning message shown during the flashing process',
  },
  preparationStepTitle: {
    id: 'app-lab.flasher.preparation-step-title',
    defaultMessage: 'Preparing the hardware',
    description: 'Title shown during the preparation step',
  },
  preparationStepDescription: {
    id: 'app-lab.flasher.preparation-step-description',
    defaultMessage:
      'To prepare the hardware for flashing, follow the instructions below:',
    description: 'Description shown during the preparation step',
  },
  preparationStepInstruction1: {
    id: 'app-lab.flasher.preparation-step-instruction-1',
    defaultMessage: '<bold>Disconnect from power source</bold>',
    description: 'First instruction shown during the preparation step',
  },
  preparationStepInstruction1Alternative: {
    id: 'app-lab.flasher.preparation-step-instruction-1-alternative',
    defaultMessage:
      '<bold>Disconnect the USB cable  it from your computer</bold>',
    description:
      'Alternative first instruction shown during the preparation step',
  },
  preparationStepInstruction2: {
    id: 'app-lab.flasher.preparation-step-instruction-2',
    defaultMessage:
      '<bold>Add the F2F jumper</bold> between the two pins specified in the image',
    description: 'Second instruction shown during the preparation step',
  },
  preparationStepInstruction2TooltipTitle: {
    id: 'app-lab.flasher.preparation-step-instruction-2-tooltip-title',
    defaultMessage: 'Missing a jumper?',
    description:
      'Title for the tooltip providing information about the F2F jumper',
  },
  preparationStepInstruction2TooltipContent: {
    id: 'app-lab.flasher.preparation-step-instruction-2-tooltip-content',
    defaultMessage:
      'A thin metal workaround (wire, clip, coin) is fine — just be kind to the pins.',
    description:
      'Content for the tooltip providing information about the F2F jumper',
  },
  preparationStepInstruction3: {
    id: 'app-lab.flasher.preparation-step-instruction-3',
    defaultMessage:
      '<bold>Connect</bold> the board to your computer, using a <bold>USB-C® type cable.</bold>',
    description: 'Third instruction shown during the preparation step',
  },
  preparationStepWaitingLabel: {
    id: 'app-lab.flasher.preparation-step-waiting-label',
    defaultMessage: 'Waiting for the board...',
    description: 'Label shown while waiting for the board connection',
  },
  flashingStepTitle: {
    id: 'app-lab.flasher.flashing-step-title',
    defaultMessage: 'Flash',
    description: 'Title shown during the flashing step',
  },
  flashingStepDownloadingLabel: {
    id: 'app-lab.flasher.flashing-step-downloading-label',
    defaultMessage: 'Downloading | {progress}%',
    description: 'Label shown while downloading the image',
  },
  flashingStepExtractingLabel: {
    id: 'app-lab.flasher.flashing-step-extracting-label',
    defaultMessage: 'Extracting',
    description: 'Label shown while extracting the image',
  },
  flashingStepFlashingLabel: {
    id: 'app-lab.flasher.flashing-step-flashing-label',
    defaultMessage: 'Flashing {progress} of {total} partitions.',
    description: 'Label shown while flashing the board',
  },
  flashingStepFlashingWaitingLabel: {
    id: 'app-lab.flasher.flashing-step-flashing-waiting-label',
    defaultMessage: 'This step may take up to 5 minutes...',
    description: 'Progress information shown during flashing step',
  },
  flashingStepSucceededLabel: {
    id: 'app-lab.flasher.flashing-step-succeeded-label',
    defaultMessage: 'Complete',
    description: 'Label shown when the flashing process is completed',
  },
  flashingStepFailedLabel: {
    id: 'app-lab.flasher.flashing-step-failed-label',
    defaultMessage: 'Update failed',
    description: 'Label shown when the flashing process has failed',
  },
  flashingStepShowLogsButton: {
    id: 'app-lab.flasher.flashing-step-logs-button',
    defaultMessage: 'Show Logs',
    description: 'Button label to show flashing logs',
  },
  flashingStepHideLogsButton: {
    id: 'app-lab.flasher.flashing-step-hide-logs-button',
    defaultMessage: 'Hide Logs',
    description: 'Button label to hide flashing logs',
  },
  flashingStepSucceededInstructions: {
    id: 'app-lab.flasher.flashing-step-succeeded-instructions',
    defaultMessage: 'Proceed with the following steps:',
    description: 'Description shown when the flashing process is successful',
  },
  flashingStepSucceededInstruction1: {
    id: 'app-lab.flasher.flashing-step-succeeded-instruction-1',
    defaultMessage: 'Unplug the board',
    description:
      'First instruction shown when the flashing process is successful',
  },
  flashingStepSucceededInstruction2: {
    id: 'app-lab.flasher.flashing-step-succeeded-instruction-2',
    defaultMessage: 'Remove the jumper',
    description:
      'Second instruction shown when the flashing process is successful',
  },
  flashingStepSucceededInstruction3: {
    id: 'app-lab.flasher.flashing-step-succeeded-instruction-3',
    defaultMessage: 'Plug the board in again',
    description:
      'Third instruction shown when the flashing process is successful',
  },
  flashingStepSucceededDescription: {
    id: 'app-lab.flasher.flashing-step-succeeded-description',
    defaultMessage:
      'The process may require a <bold>few attempts</bold>. If the problem persists, please <link>contact us for support.</link>',
    description: 'Description shown when the flashing process is successful',
  },
  flashingStepSucceededDoneButton: {
    id: 'app-lab.flasher.flashing-step-succeeded-done-button',
    defaultMessage: 'Ok, done',
    description: 'Button label to close flashing after success',
  },
  flashingStepFailedDescription1: {
    id: 'app-lab.flasher.flashing-step-failed-description-1',
    defaultMessage: 'Something went wrong while flashing the update.',
    description: 'Description shown when the flashing process has failed',
  },
  flashingStepFailedDescription2: {
    id: 'app-lab.flasher.flashing-step-failed-description-2',
    defaultMessage:
      'Try again — and if it keeps happening, you can reach out to <link>Support.</link>',
    description: 'Description shown when the flashing process has failed',
  },
  flashingStepFailedRetryButton: {
    id: 'app-lab.flasher.flashing-step-failed-retry-button',
    defaultMessage: 'Retry',
    description: 'Button label to retry flashing after failure',
  },
  error: {
    id: 'app-lab.flasher.generic-error',
    defaultMessage: 'Unknown error while flashing the board. Please try again.',
    description: 'Generic error message shown in the flasher page',
  },
  exitButton: {
    id: 'app-lab.flasher.exit-button',
    defaultMessage: 'Exit',
    description: 'Button label to exit the flasher page',
  },
});
