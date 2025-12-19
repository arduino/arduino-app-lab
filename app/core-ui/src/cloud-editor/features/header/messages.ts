import { defineMessages } from 'react-intl';

import { HeaderItemId } from './Header.type';

export const headerTitleMessages = defineMessages<
  keyof Omit<typeof HeaderItemId, 'None'>
>({
  [HeaderItemId.Sketch]: {
    id: 'headerTitle.sketch',
    defaultMessage: 'Sketches',
    description: 'Sketches',
  },
  [HeaderItemId.Example]: {
    id: 'headerTitle.example',
    defaultMessage: 'Example',
    description: 'Example',
  },
  [HeaderItemId.CustomLibrary]: {
    id: 'headerTitle.customLibrary',
    defaultMessage: 'Library',
    description: 'Library',
  },
});

export const headerMessages = defineMessages({
  signIn: {
    id: 'header.signIn',
    defaultMessage: 'Sign In',
    description: 'Sign In',
  },
});
