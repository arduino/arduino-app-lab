import { defineMessages } from 'react-intl';

export const messages = defineMessages({
  aiModelInUse: {
    id: 'brickDetail.aiModelInUse',
    defaultMessage: 'Model in use',
    description: 'Label indicating the AI model currently in use',
  },
  aiModelDownloadingLabel: {
    id: 'app-lab.aiModelDownloadingLabel',
    defaultMessage: 'Downloading ({progress}%)',
    description: 'Label shown while downloading the AI model',
  },
  aiModelUninstallingLabel: {
    id: 'app-lab.aiModelUninstallingLabel',
    defaultMessage: 'Uninstalling...',
    description: 'Label shown while uninstalling the AI model',
  },
  aiModelDownloadLabel: {
    id: 'app-lab.aiModelDownloadLabel',
    defaultMessage: 'Download',
    description: 'Label for the download button of the AI model',
  },
  aiModelDiskUsageWarning: {
    id: 'app-lab.aiModelDiskUsageWarning',
    defaultMessage: 'Used: {used} GB of {total} GB',
    description: 'Warning message showing disk usage for the AI model',
  },
  aiModelInstalled: {
    id: 'app-lab.aiModelInstalled',
    defaultMessage: 'Installed',
    description: 'Label indicating the AI model is installed',
  },
  aiModelEdit: {
    id: 'app-lab.aiModelEdit',
    defaultMessage: 'Edit model',
    description: 'Label for the edit model action',
  },
  aiModelExampleTooltip: {
    id: 'app-lab.aiModelExampleTooltip',
    defaultMessage: "Models can't be changed in examples",
    description:
      'Tooltip shown on the model selection radio inside example apps',
  },
  aiModelDownloadToEnableTooltip: {
    id: 'app-lab.aiModelDownloadToEnableTooltip',
    defaultMessage: 'Download the model to enable',
    description:
      'Tooltip shown on the model selection radio when the model is not installed',
  },
});
