import { defineMessages } from 'react-intl';

export const messages = defineMessages({
  run: {
    id: 'serialMonitor.toolbar.run',
    defaultMessage: 'Run',
    description: 'Label for the button used to run the serial monitor.',
  },
  pause: {
    id: 'serialMonitor.toolbar.pause',
    defaultMessage: 'Pause',
    description: 'Label for the button used to pause the serial monitor.',
  },
  viewNewData: {
    id: 'serialMonitor.body.viewNewData',
    defaultMessage: 'View new data',
    description: 'Label for the button used to view the new data.',
  },
  connecting: {
    id: 'serialMonitor.body.connecting',
    defaultMessage: 'Connecting...',
    description: 'Label to indicate the serial monitor is connecting.',
  },
  unavailable: {
    id: 'serialMonitor.body.unavailable',
    defaultMessage: 'Serial monitor unavailable.',
    description: 'Label to indicate the serial monitor is unavailable.',
  },
  connectionLost: {
    id: 'serialMonitor.body.connectionLost',
    defaultMessage:
      'We can’t find the device, please make sure it is connected via serial port.\nYou can still see log history here, but data won’t be printed until new connection.',
    description: 'Label to indicate the serial monitor connection is lost.',
  },
  send: {
    id: 'serialMonitor.body.send',
    defaultMessage: 'Send',
    description: 'Label for the button used to send data.',
  },
  noLineEnding: {
    id: 'serialMonitor.body.noLineEnding',
    defaultMessage: 'No Line Ending',
    description: 'Line ending input button value: No line ending',
  },
  newLine: {
    id: 'serialMonitor.body.newLine',
    defaultMessage: 'New Line',
    description: 'Line ending input button value: New line',
  },
  carriageReturn: {
    id: 'serialMonitor.body.carriageReturn',
    defaultMessage: 'Carriage Return',
    description: 'Line ending input button value: Carriage Return',
  },
  bothNLandCR: {
    id: 'serialMonitor.body.bothNLandCR',
    defaultMessage: 'Both NL & CR',
    description:
      'Line ending input button value: Both new line and carriage return',
  },
  clearLog: {
    id: 'serialMonitor.body.clearLog',
    defaultMessage: 'Clear log',
    description:
      'Label for the button used to clear the serial monitor data log.',
  },
  showTimestamp: {
    id: 'serialMonitor.body.showTimestamp',
    defaultMessage: 'Show Timestamp',
    description:
      'Label for the button used to show the serial monitor timestamps.',
  },
  hideTimestamp: {
    id: 'serialMonitor.body.hideTimestamp',
    defaultMessage: 'Hide Timestamp',
    description:
      'Label for the button used to hide the serial monitor timestamps.',
  },
  downloadLog: {
    id: 'serialMonitor.body.downloadLog',
    defaultMessage: 'Download Log',
    description:
      'Label for the button used to download the serial monitor log.',
  },
  searchLog: {
    id: 'serialMonitor.body.searchLog',
    defaultMessage: 'Search log',
    description:
      'Label for the button used to search the serial monitor data log.',
  },
  searchLogDisabled: {
    id: 'serialMonitor.body.searchLogDisabled',
    defaultMessage:
      'To enable the Search, first put the serial monitor in pause.',
    description:
      "Label for the tooltip used to inform that the serial monitor search can't be enabled unless the serial monitor is in pause.",
  },
});
