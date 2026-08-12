import { defineMessages } from 'react-intl';

export const cloudConnectorMessages = defineMessages({
  connectedDescription: {
    id: 'cloudConnectorContext.connectedDescription',
    defaultMessage: 'Device successfully connected to Arduino Cloud',
    description: 'Description for when the board is connected to Arduino Cloud',
  },
  connectionFailedDescription: {
    id: 'cloudConnectorContext.connectionFailedDescription',
    defaultMessage: 'Connection failed. Please try again.',
    description:
      'Description for when the board connection to Arduino Cloud fails',
  },
  deviceAlreadyClaimedDescription: {
    id: 'cloudConnectorContext.deviceAlreadyClaimedDescription',
    defaultMessage: 'Connection failed. This device is already claimed.',
    description:
      'Description for when the board is already claimed in Arduino Cloud',
  },
  disconnectedDescription: {
    id: 'cloudConnectorContext.disconnectedDescription',
    defaultMessage: 'Device successfully deleted from Arduino Cloud',
    description:
      'Description for when the board is disconnected from Arduino Cloud',
  },
});
