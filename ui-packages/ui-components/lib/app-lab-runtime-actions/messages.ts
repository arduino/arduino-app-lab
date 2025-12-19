import { defineMessages } from 'react-intl';

export const messages = defineMessages({
  runAtStartup: {
    id: 'appLabRuntimeActions.runAtStartup',
    defaultMessage: 'Run at startup',
    description: 'Label for the run at startup action',
  },
  setAsDefault: {
    id: 'appLabRuntimeActions.setAsDefault',
    defaultMessage:
      'This app is set as the startup app. This means it will automatically run every time you plug your board into <bold>any power source</bold>',
    description: 'Label for the set as default app',
  },
  overrideAsDefault: {
    id: 'appLabRuntimeActions.overrideAsDefault',
    defaultMessage:
      'Only one app can be set to launch at startup. Enabling this feature for the current app will <bold>override the {appName} app</bold>.',
    description: 'Label for the override default app',
  },
});
