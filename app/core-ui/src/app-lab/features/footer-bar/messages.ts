import { defineMessages } from 'react-intl';

export const messages = defineMessages({
  updateAvailable: {
    id: 'footer.update-available',
    defaultMessage: 'New AppLab version! Update now',
    description: 'Label for the update available notification',
  },
  updateAvailableTooltip: {
    id: 'footer.update-available-tooltip',
    defaultMessage: 'Version {v} is available. Click to update.',
    description: 'Label for the update available tooltip',
  },
  cpu: {
    id: 'footer.cpu',
    defaultMessage: 'CPU: {used}%',
    description: 'Label for the cpu used percentage',
  },
  memory: {
    id: 'footer.memory',
    defaultMessage: 'RAM: {used}/{total}GB',
    description: 'Label for the memory usage',
  },
  disk: {
    id: 'footer.disk',
    defaultMessage: '{path} {used}/{total}GB',
    description: 'Label for the disk space usage',
  },
  ip: {
    id: 'footer.ip',
    defaultMessage: '{type}: {ip}',
    description: 'Label for the board ip address',
  },
});
