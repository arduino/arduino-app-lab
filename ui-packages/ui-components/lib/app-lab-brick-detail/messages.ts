import { defineMessages } from 'react-intl';

export const messages = defineMessages({
  aiModelBadge: {
    id: 'brickDetail.aiModelBadge',
    defaultMessage: 'AI',
    description: 'Badge label indicating the brick uses an AI model',
  },
  overviewTab: {
    id: 'brickDetail.overview',
    defaultMessage: 'Overview',
    description: 'Label for the overview tab',
  },
  examplesTab: {
    id: 'brickDetail.examples',
    defaultMessage: 'Usage examples',
    description: 'Label for the examples tab',
  },
  documentationTab: {
    id: 'brickDetail.documentation',
    defaultMessage: 'API documentation',
    description: 'Label for the documentation tab',
  },
  aiModelsTab: {
    id: 'brickDetail.aiModels',
    defaultMessage: 'AI models',
    description: 'Label for the AI models tab',
  },
  aiModelsInfo: {
    id: 'brickDetail.aiModelsInfo',
    defaultMessage:
      'Use "<link>Brick configuration</link>" to change the applied ai model.',
    description: 'Information about the AI models used by the brick',
  },
  aiModelInUse: {
    id: 'brickDetail.aiModelInUse',
    defaultMessage: 'IN USE',
    description: 'Label indicating the AI model currently in use',
  },
  fileNotFound: {
    id: 'brickDetail.fileNotFound',
    defaultMessage: 'File not found',
    description: 'Message displayed when a file is not found',
  },
  configureButton: {
    id: 'brickDetail.configureButton',
    defaultMessage: 'Brick configuration',
    description: 'Label for the configure button',
  },
  usedInTitle: {
    id: 'brickDetail.usedInTitle',
    defaultMessage: 'Used in',
    description: 'Title for the section listing apps that use the brick',
  },
});
