import { defineMessages } from 'react-intl';

import { SetupItemId } from './setup.type';

export const welcomeMessages = defineMessages({
  title: {
    id: 'appLabSetup.welcome.title',
    defaultMessage: 'Welcome to Arduino App Lab',
    description: 'Title for the welcome section of the App Lab setup',
  },
  description: {
    id: 'appLabSetup.welcome.description',
    defaultMessage: 'Connect your Arduino UNO Q to start',
    description: 'Description for the welcome section of the App Lab setup',
  },
  descriptionMultipleBoards: {
    id: 'appLabSetup.welcome.descriptionMultipleBoards',
    defaultMessage: 'Multiple boards are connected, please select one to start',
    description:
      'Description for the welcome section of the App Lab setup when multiple boards are connected',
  },
  connected: {
    id: 'appLabSetup.welcome.connected',
    defaultMessage: 'Connected',
    description: 'Message indicating that the board is connected',
  },
  noDevice: {
    id: 'appLabSetup.welcome.noDevice',
    defaultMessage: 'No device',
    description: 'Message indicating that no device is connected',
  },
  connectYourBoard: {
    id: 'appLabSetup.welcome.connectYourBoard',
    defaultMessage: 'Connect board',
    description: 'Message prompting the user to connect their board',
  },
  connectYourBoardDescription: {
    id: 'appLabSetup.welcome.connectYourBoardDescription',
    defaultMessage: 'Waiting for a board to be connected',
    description: 'Description for the connect your board message',
  },
  chooseBoard: {
    id: 'appLabSetup.welcome.chooseBoard',
    defaultMessage: 'Choose a board to get started.',
    description: 'Subtitle when multiple boards are available',
  },
  chooseBoardDescription: {
    id: 'appLabSetup.welcome.chooseBoardDescription',
    defaultMessage: 'Connect one via USB or access a board on your network.',
    description: 'Description when multiple boards are available',
  },
  availableViaUsb: {
    id: 'appLabSetup.welcome.availableViaUsb',
    defaultMessage: 'Available via USB',
    description: 'Group header for USB-connected boards',
  },
  availableOnNetwork: {
    id: 'appLabSetup.welcome.availableOnNetwork',
    defaultMessage: 'Available on your network',
    description: 'Group header for network-connected boards',
  },
  linuxPasswordTitle: {
    id: 'appLabSetup.welcome.linuxPasswordTitle',
    defaultMessage: 'Linux password',
    description: 'Title for the Linux password dialog',
  },
  cancelButton: {
    id: 'appLabSetup.welcome.cancelButton',
    defaultMessage: 'Cancel',
    description: 'Cancel button text',
  },
  confirmButton: {
    id: 'appLabSetup.welcome.confirmButton',
    defaultMessage: 'Confirm',
    description: 'Confirm button text',
  },
  usernameLabel: {
    id: 'appLabSetup.welcome.usernameLabel',
    defaultMessage: 'Username',
    description: 'Label for the username input field',
  },
  passwordLabel: {
    id: 'appLabSetup.welcome.passwordLabel',
    defaultMessage: 'Password',
    description: 'Label for the password input field',
  },
  noBoardsFound: {
    id: 'appLabSetup.welcome.noBoardsFound',
    defaultMessage: 'No boards found',
    description: 'Message when no boards are found',
  },
  newBoardBadge: {
    id: 'appLabSetup.welcome.newBoardBadge',
    defaultMessage: 'NEW BOARD',
    description: 'Text for the new board badge',
  },
  lastConnectionPrefix: {
    id: 'appLabSetup.welcome.lastConnectionPrefix',
    defaultMessage: 'Last connection:',
    description: 'Prefix for the last connection timestamp',
  },
});

export const setupMessages = defineMessages<SetupItemId>({
  [SetupItemId.BoardConfiguration]: {
    id: 'appLabSetup.boardConfiguration',
    defaultMessage: 'Board Configuration',
    description: 'Board Configuration',
  },
  [SetupItemId.NetworkSetup]: {
    id: 'appLabSetup.networkSetup',
    defaultMessage: 'Network Setup',
    description: 'Network Setup',
  },
  [SetupItemId.LinuxCredentials]: {
    id: 'appLabSetup.linuxCredentials',
    defaultMessage: 'Linux Credentials',
    description: 'Linux Credentials',
  },
  [SetupItemId.ArduinoAccount]: {
    id: 'appLabSetup.arduinoAccount',
    defaultMessage: 'Arduino Account',
    description: 'Arduino Account',
  },
});

export const boardConfigurationMessages = defineMessages({
  keyboardLabel: {
    id: 'appLabSetup.boardConfiguration.keyboardLabel',
    defaultMessage: 'Keyboard Layout',
    description: 'Label for the keyboard layout input field',
  },
  nameLabel: {
    id: 'appLabSetup.boardConfiguration.nameLabel',
    defaultMessage: 'Board Name',
    description: 'Label for the board name input field',
  },
  boardConfigurationError: {
    id: 'appLabSetup.boardConfiguration.boardConfigurationError',
    defaultMessage: 'Error setting board configuration',
    description:
      'Message displayed when there is an error setting the board configuration',
  },
  boardConfigurationSuccess: {
    id: 'appLabSetup.boardConfiguration.boardConfigurationSuccess',
    defaultMessage: 'Board configuration set successfully',
    description:
      'Message displayed when the board configuration is set successfully',
  },
});

export const linuxCredentialsMessages = defineMessages({
  descriptionLabel: {
    id: 'appLabSetup.linuxCredentials.descriptionLabel',
    defaultMessage: 'Select a password for your Linux account',
    description: 'Description for the linux credentials setup section',
  },
  usernameLabel: {
    id: 'appLabSetup.linuxCredentials.usernameLabel',
    defaultMessage: 'Username',
    description: 'Label for the username input field',
  },
  passwordLabel: {
    id: 'appLabSetup.linuxCredentials.passwordLabel',
    defaultMessage: 'Password',
    description: 'Label for the password input field',
  },
  passwordConfirmationLabel: {
    id: 'appLabSetup.linuxCredentials.passwordConfirmationLabel',
    defaultMessage: 'Confirm Password',
    description: 'Label for the password confirmation input field',
  },
  linuxCredentialsError: {
    id: 'appLabSetup.linuxCredentials.linuxCredentialsError',
    defaultMessage: 'Error setting user credentials',
    description:
      'Message displayed when there is an error setting the user credentials',
  },
  linuxCredentialsSuccess: {
    id: 'appLabSetup.linuxCredentials.linuxCredentialsSuccess',
    defaultMessage: 'User credentials set successfully',
    description:
      'Message displayed when the user credentials are set successfully',
  },
});

export const sectionTitleMessages = defineMessages<SetupItemId>({
  [SetupItemId.BoardConfiguration]: {
    id: 'appLabSetup.boardName.title',
    defaultMessage: 'Board configuration',
    description: 'Title for the board name setup section',
  },
  [SetupItemId.NetworkSetup]: {
    id: 'appLabSetup.networkSetup.title',
    defaultMessage: 'Network Setup',
    description: 'Title for the network setup section',
  },
  [SetupItemId.LinuxCredentials]: {
    id: 'appLabSetup.linuxCredentials.title',
    defaultMessage: 'Linux Credentials',
    description: 'Title for the linux credentials setup section',
  },
  [SetupItemId.ArduinoAccount]: {
    id: 'appLabSetup.arduinoAccount.title',
    defaultMessage: 'Arduino Account',
    description: 'Title for the Arduino account setup section',
  },
});

export const sectionActionMessages = defineMessages<SetupItemId>({
  [SetupItemId.BoardConfiguration]: {
    id: 'appLabSetup.boardName.action',
    defaultMessage: 'Next',
    description: 'Action for the board configuration setup section',
  },
  [SetupItemId.NetworkSetup]: {
    id: 'appLabSetup.networkSetup.action',
    defaultMessage: 'Confirm',
    description: 'Action for the network setup section',
  },
  [SetupItemId.LinuxCredentials]: {
    id: 'appLabSetup.linuxCredentials.action',
    defaultMessage: 'Confirm',
    description: 'Action for the linux credentials setup section',
  },
  [SetupItemId.ArduinoAccount]: {
    id: 'appLabSetup.arduinoAccount.action',
    defaultMessage: 'Confirm',
    description: 'Action for the Arduino account setup section',
  },
});

export const tooltipMessages = defineMessages({
  wifiTooltipTitle: {
    id: 'appLabSetup.wifi.tooltip.title',
    defaultMessage: 'Why we ask for this',
    description:
      'Title for the wifi tooltip explaining network connection requirements',
  },
  wifiTooltipContent: {
    id: 'appLabSetup.wifi.tooltip.content',
    defaultMessage:
      'App Lab requires a network connection only during the initial configuration to ensure the most up-to-date experience.',
    description:
      'Content for the wifi tooltip explaining network connection requirements',
  },
  accountTooltipTitle: {
    id: 'appLabSetup.account.tooltip.title',
    defaultMessage: 'Why do we ask for this?',
    description:
      'Title for the account tooltip explaining Arduino account requirements',
  },
  accountTooltipContent: {
    id: 'appLabSetup.account.tooltip.content',
    defaultMessage:
      'App Lab works out of the box without an Arduino account, but signing in lets you unlock the full experience and enjoy every feature.',
    description:
      'Content for the account tooltip explaining Arduino account requirements',
  },
  chipConnectionTooltip: {
    id: 'appLabSetup.chip.connection.tooltip',
    defaultMessage: 'Connected via {chip}',
    description: 'Tooltip content showing the connection method for the board chip',
  },
});
