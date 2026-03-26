import { defineMessages } from 'react-intl';

export const messages = defineMessages({
  changePassword: {
    id: 'appLab.changePasswordDialog.changePassword',
    defaultMessage: 'Change Linux Password',
    description: 'Title for the change password dialog in the settings page',
  },
  save: {
    id: 'appLab.changePasswordDialog.save',
    defaultMessage: 'Save',
    description: 'Label for the save button in the change password dialog',
  },
  subtitle: {
    id: 'appLab.changePasswordDialog.subtitle',
    defaultMessage: 'Set a New Password',
    description: 'Subtitle for the change password dialog in the settings page',
  },
  description: {
    id: 'appLab.changePasswordDialog.description',
    defaultMessage:
      'This change will affect your <bold>Linux system</bold>.<br></br> Please be sure to save your new password in a safe place.',
    description:
      'Description for the change password dialog in the settings page',
  },
  newPassword: {
    id: 'appLab.changePasswordDialog.newPassword',
    defaultMessage: 'New Password',
    description: 'Label for the new password input',
  },
  confirmPassword: {
    id: 'appLab.changePasswordDialog.confirmPassword',
    defaultMessage: 'Confirm Password',
    description: 'Label for the confirm password input',
  },
  helperText: {
    id: 'appLab.changePasswordDialog.helperText',
    defaultMessage: 'Password must be at least 8 characters long.',
    description: 'Helper text for password validation',
  },
  passwordMismatch: {
    id: 'appLab.changePasswordDialog.passwordMismatch',
    defaultMessage: 'Passwords do not match',
    description: 'Error message when passwords do not match',
  },
  genericError: {
    id: 'appLab.changePasswordDialog.genericError',
    defaultMessage: 'An error occurred while changing the password',
    description: 'Generic error message when changing password fails',
  },
});
