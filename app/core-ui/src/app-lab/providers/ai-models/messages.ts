import { defineMessages } from 'react-intl';

export const aiModelsMessages = defineMessages({
  modelDownloaded: {
    id: 'aiModelsContext.modelDownloaded',
    defaultMessage: 'Model {name} downloaded',
    description: 'Notification shown when an AI model finished downloading',
  },
  modelAlreadyInstalled: {
    id: 'aiModelsContext.modelAlreadyInstalled',
    defaultMessage: 'Model {name} is already installed',
    description:
      'Notification shown when a download finishes on a model that was installed before it started',
  },
  modelDownloadedTooltip: {
    id: 'aiModelsContext.modelDownloadedTooltip',
    defaultMessage: 'Click to view in My Apps',
    description: 'Tooltip of the footer notification for a downloaded AI model',
  },
  insufficientStorage: {
    id: 'aiModelsContext.insufficientStorage',
    defaultMessage: 'Insufficient space on the board.',
    description:
      'Error shown when the board has no room left for the model being downloaded',
  },
  invalidModelUrl: {
    id: 'aiModelsContext.invalidModelUrl',
    defaultMessage: 'The link is not a Hugging Face GGUF model.',
    description:
      'Error shown when the model link is not a Hugging Face link to a GGUF file or repository',
  },
  modelNotFound: {
    id: 'aiModelsContext.modelNotFound',
    defaultMessage:
      'The model does not exist on Hugging Face, or it is not public.',
    description:
      'Error shown when the Hugging Face repository, revision or file does not exist, or the repository is private',
  },
  modelPrivateOrGated: {
    id: 'aiModelsContext.modelPrivateOrGated',
    defaultMessage:
      'The model is private or gated. Only public models can be downloaded.',
    description:
      'Error shown when the Hugging Face repository is private or needs its conditions accepted',
  },
  modelDisabled: {
    id: 'aiModelsContext.modelDisabled',
    defaultMessage: 'The authors disabled this model on Hugging Face.',
    description:
      'Error shown when the Hugging Face repository was disabled by its authors',
  },
  modelIncompatible: {
    id: 'aiModelsContext.modelIncompatible',
    defaultMessage: 'The board does not support this model.',
    description:
      'Error shown when the model quantization or architecture is not supported on the board',
  },
  noCompatibleFile: {
    id: 'aiModelsContext.noCompatibleFile',
    defaultMessage: 'The repository has no GGUF model file.',
    description:
      'Error shown when the Hugging Face repository contains no GGUF file',
  },
  hubUnreachable: {
    id: 'aiModelsContext.hubUnreachable',
    defaultMessage:
      'The board cannot reach Hugging Face. Check its internet connection.',
    description:
      'Error shown when the board cannot connect to Hugging Face, or the connection timed out',
  },
  downloadEndedUnexpectedly: {
    id: 'aiModelsContext.downloadEndedUnexpectedly',
    defaultMessage: 'The model download ended unexpectedly',
    description:
      'Error shown when the model download stream ends without reporting a result',
  },
  downloadFailed: {
    id: 'aiModelsContext.downloadFailed',
    defaultMessage: 'An error occurred while downloading model',
    description: 'Generic error shown when an AI model download fails',
  },
  updateAppLab: {
    id: 'aiModelsContext.updateAppLab',
    defaultMessage: 'Update App Lab in Settings to link a model.',
    description:
      'Notification shown when the running App Lab is too old to download a model from a url',
  },
  goToSettings: {
    id: 'aiModelsContext.goToSettings',
    defaultMessage: 'Go to settings',
    description:
      'Action of the notification that asks the user to update App Lab',
  },
  downloadFailedWithReason: {
    id: 'aiModelsContext.downloadFailedWithReason',
    defaultMessage: 'Error downloading model: {reason}',
    description:
      'Error shown when an AI model download fails with a reported reason',
  },
});
