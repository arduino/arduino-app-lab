import { defineMessages } from 'react-intl';

export const messages = defineMessages({
  systemStats: {
    id: 'appLabFooterBar.systemStats',
    defaultMessage: 'System stats',
    description: 'Label for the system stats button and title',
  },
  systemInfo: {
    id: 'appLabFooterBar.systemInfo',
    defaultMessage: 'System Info',
    description: 'Header for the system info overlay',
  },
  storage: {
    id: 'appLabFooterBar.storage',
    defaultMessage: 'STORAGE: ',
    description: 'Label for storage stats',
  },
  version: {
    id: 'appLabFooterBar.version',
    defaultMessage: 'v. {version}',
    description: 'Version display label',
  },
});
