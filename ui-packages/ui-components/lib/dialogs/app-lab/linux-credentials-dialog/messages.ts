import { defineMessages } from 'react-intl';

export const linuxCredentialsDialogMessages = defineMessages({
  title: {
    id: 'linuxCredentialsDialog.title',
    defaultMessage: 'Linux Credentials',
    description: 'Title of the Linux credentials dialog',
  },
  usernameLabel: {
    id: 'linuxCredentialsDialog.usernameLabel',
    defaultMessage: 'Username',
    description: 'Label for the username input field',
  },
  passwordLabel: {
    id: 'linuxCredentialsDialog.passwordLabel',
    defaultMessage: 'Password',
    description: 'Label for the password input field',
  },
  cancel: {
    id: 'linuxCredentialsDialog.cancel',
    defaultMessage: 'Cancel',
    description: 'Button to cancel the credentials dialog',
  },
  confirm: {
    id: 'linuxCredentialsDialog.confirm',
    defaultMessage: 'Confirm',
    description: 'Button to confirm and submit the credentials',
  },
});
