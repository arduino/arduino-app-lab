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
  aiModelInUse: {
    id: 'brickDetail.aiModelInUse',
    defaultMessage: 'Model in use',
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
  missingModel: {
    id: 'brickDetail.missingModel',
    defaultMessage:
      "Don't see your model here? You may need to select <bold>{boardModel}</bold> as the target in Edge Impulse Studio.",
    description:
      'Alert message for missing board model filter for custom models',
  },
  trainNewModel: {
    id: 'brickDetail.trainNewModel',
    defaultMessage: 'Train new AI model',
    description: 'Label for the button and title to train a new AI model',
  },
  trainNewModelDescription: {
    id: 'brickDetail.trainNewModelDescription',
    defaultMessage:
      'Create and train your own AI model using Edge Impulse Studio. An Arduino account login is required.',
    description: 'Description for the action to train a new AI model',
  },
  linkHuggingFace: {
    id: 'aiModel.linkHuggingFace',
    defaultMessage: 'Link model from Hugging Face',
    description: 'Label for the link to view the model on Hugging Face',
  },
  customAIModelTitle: {
    id: 'brickDetail.customAIModelTitle',
    defaultMessage: 'Bring your own model',
    description: 'Title for custom AI models that can be linked to the brick',
  },
  uploadGGUF: {
    id: 'aiModel.uploadGGUF',
    defaultMessage: 'Upload Model .GGUF',
    description: 'Label for the button to upload a GGUF model',
  },
});

export const aiModelMessages = defineMessages({
  moreInfo: {
    id: 'aiModel.moreInfo',
    defaultMessage: '+ More info',
    description: 'Label for the button to show more info',
  },
  lessInfo: {
    id: 'aiModel.lessInfo',
    defaultMessage: '- Less info',
    description: 'Label for the button to show less info',
  },
  modelCard: {
    id: 'aiModel.modelCard',
    defaultMessage: 'Model card',
    description: 'Label for the model card',
  },
  source: {
    id: 'aiModel.source',
    defaultMessage: 'Source: {source}',
    description: 'Label for the source',
  },
  eiProjectID: {
    id: 'aiModel.eiProjectID',
    defaultMessage: '{isEI}Project ID: {id}',
    description: 'Label for the EI Project ID',
  },
});
