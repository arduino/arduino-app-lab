import { defineMessages } from 'react-intl';

export const messages = defineMessages({
  dialogTitle: {
    id: 'webSerial.dialogTitle',
    defaultMessage: 'Authorize USB connection',
    description:
      'Title for the dialog shown when the user needs to authorize the USB connection',
  },
  dialogQuestion: {
    id: 'webSerial.dialogQuestion',
    defaultMessage:
      'To allow uploads, Arduino Cloud Editor needs permission to access USB port of your Chromebook. Select the port you want to use in the following list',
    description:
      'Question shown in the dialog when the user needs to authorize the USB connection',
  },
  dialogPositiveButton: {
    id: 'webSerial.dialogPositiveButton',
    defaultMessage: 'Select port',
    description:
      'Positive button text for the dialog shown when the user needs to authorize the USB connection',
  },
  boardResetHint: {
    id: 'webSerial.boardResetHint',
    defaultMessage:
      'If you don’t find your board in the following list, please try to reset it by a quick double press of the Reset button (RST) on the board',
    description:
      'Hint shown in the dialog when the user needs to reset the board',
  },

  // the following messages are specific for boards supporting the UF2 format.
  // e.g. Arduino Nano RP2040
  uf2DialogQuestion: {
    id: 'webSerial.uf2DialogQuestion',
    defaultMessage:
      // eslint-disable-next-line formatjs/no-multiple-whitespaces
      'To upload the sketch on the Arduino RP2040 board, you just need to save it on the <strong>RPI-RP2 USB removable unit</strong> now available on your Chromebook.<br> By proceeding, you will be able to save and complete the upload of the sketch.',
    description:
      'Specific for Arduino RP2040. Question shown in the dialog when the user needs to save a UF2 file on their board.',
  },
  uf2DialogTitle: {
    id: 'webSerial.uf2DialogTitle',
    defaultMessage: 'Save the sketch to upload it',
    description:
      'Specific for Arduino RP2040. Title for the dialog shown when the user needs to save a UF2 file on their board',
  },
  uf2DialogPositiveButton: {
    id: 'webSerial.uf2DialogPositiveButton',
    defaultMessage: 'Continue',
    description:
      'Specific for Arduino RP2040. Positive button text for the dialog, shown when the user needs to choose the RPI-RP2 drive to save the UF2 file',
  },
  uf2DialogNegativeButton: {
    id: 'webSerial.uf2DialogNegativeButton',
    defaultMessage: 'Cancel',
    description:
      'Specific for Arduino RP2040. Negative button text for the dialog, shown when the user needs to choose the RPI-RP2 drive to save the UF2 file',
  },
});
