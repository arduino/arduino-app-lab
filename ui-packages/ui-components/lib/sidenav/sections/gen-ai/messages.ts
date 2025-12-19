import { defineMessages } from 'react-intl';

export const headerMessages = defineMessages({
  clearChatButton: {
    id: 'genai.clear-chat-button',
    defaultMessage: 'Clear chat',
    description: 'Clear chat button',
  },
  closeButton: {
    id: 'genai.notification-close-button',
    defaultMessage: 'Close',
    description: 'Close button for the clear notification',
  },
  chatDeleted: {
    id: 'genai.notification-chat-deleted',
    defaultMessage: 'Chat deleted',
    description: 'Message for chat deleted notification',
  },
  undoButton: {
    id: 'genai.notification-undo-button',
    defaultMessage: 'Undo',
    description: 'Message for undo button in the clear notification',
  },
});

export const chatMessages = defineMessages({
  placeholderSendBox: {
    id: 'genai.placeholder-send-box',
    defaultMessage: 'Ask a question to the Arduino AI Assistant or type ‘/’',
    description: 'Placeholder for the send box in the chat',
  },
  disclaimerArduinoAssistant: {
    id: 'genai.disclaimer-arduino-assistant',
    defaultMessage:
      'The Arduino AI Assistant can make mistakes. Consider checking important information.',
    description: 'Disclaimer for the Arduino Sketch Assistant',
  },
  loadingMessage: {
    id: 'genai.loading-message',
    defaultMessage: 'Certainly! I will start searching for all need resources',
    description: 'Loading message for the chat',
  },
  generatingRequirements: {
    id: 'genai.generating-requirements',
    defaultMessage: 'Generating requirements...',
    description: 'Message for generating requirements',
  },
  surveyLabel: {
    id: 'genai.survey-label',
    defaultMessage: 'How was your experience with this conversation?',
    description: 'Message for generating requirements',
  },
  surveyButton: {
    id: 'genai.survey-button',
    defaultMessage: 'Let us know',
    description: 'Content of the link for opening survey for AI chat',
  },
  tryHintsMessage: {
    id: 'genai.try-hints-message',
    defaultMessage: 'Try these hints',
    description: 'Try hints message',
  },
  createCodeExample: {
    id: 'genai.create-code-example',
    defaultMessage: 'Create code to blink an LED without using delays',
    description: 'Create code example button',
  },
  explainFunctionExample: {
    id: 'genai.explain-function-example',
    defaultMessage: 'Explain this function: map(input, 0, 255, 0, 10)',
    description: 'Explain function example button',
  },
  generateSketchExample: {
    id: 'genai.generate-sketch-example',
    defaultMessage: 'Generate Sketch for...',
    description: 'Generate sketch example button',
  },
  suggestProjectExample: {
    id: 'genai.suggest-project-example',
    defaultMessage: 'Suggest a project idea using a strip LED',
    description: 'Suggest project example button',
  },
  generateSketchApply: {
    id: 'sketchPlan.generateSketchApply',
    defaultMessage: 'Apply',
    description: 'Apply button for generating sketch',
  },
  newMessages: {
    id: 'genai.new-messages',
    defaultMessage: 'New messages',
    description: 'New messages button',
  },
  reloadError: {
    id: 'genai.reload-error',
    defaultMessage: 'Reload error',
    description: 'Reload error button',
  },
  goToError: {
    id: 'genai.go-to-error',
    defaultMessage: 'Go to error',
    description: 'Go to error button',
  },
  fixError: {
    id: 'genai.fix-error',
    defaultMessage: 'Fix error',
    description: 'Fix error button',
  },
  fixErrorMessage: {
    id: 'genai.fix-error-message',
    defaultMessage: 'Fix the error',
    description: 'Fix error message',
  },
  applyFix: {
    id: 'genai.apply-fix',
    defaultMessage: 'Apply fix',
    description: 'Apply fix button',
  },
  applyFixMessage: {
    id: 'genai.apply-fix-message',
    defaultMessage: 'Apply recommended fix in code',
    description: 'Apply fix message',
  },
  upgradePlan: {
    id: 'genai.upgrade-plan',
    defaultMessage: 'Upgrade plan',
    description: 'Upgrade plan button',
  },
  remainingMessages: {
    id: 'genai.remaining-messages',
    defaultMessage: '{messagesLeft} messages remaining',
    description: 'Remaining messages',
  },
  references: {
    id: 'genai.references',
    defaultMessage: 'References:',
    description: 'References',
  },
});

export const sketchPlanMessages = defineMessages({
  instructionsTitle: {
    id: 'sketchPlan.instructionsTitle',
    defaultMessage: 'Step by step instructions',
    description: 'Title of instructions list for generated sketch',
  },
  diagramCheckboxLabel: {
    id: 'sketchPlan.includeDiagramCheckboxLabel',
    defaultMessage: 'Generate Circuit Diagram',
    description:
      'Label for the checkbox to add circuit diagram to generated sketch',
  },
  confirmButton: {
    id: 'sketchPlan.confirmButton',
    defaultMessage: 'Confirm',
    description: 'Label for button confirming sketch generation plan',
  },
  regenerateButton: {
    id: 'sketchPlan.regenerateButton',
    defaultMessage: 'Regenerate sketch proposal',
    description: 'Label for button regenerating plan',
  },
  cancelButton: {
    id: 'sketchPlan.cancelButton',
    defaultMessage: 'Cancel sketch proposal',
    description: 'Label for button cancelling plan',
  },
});

export const legalDisclaimerMessages = defineMessages({
  title: {
    id: 'genai.legal-disclaimer-title',
    defaultMessage: `Hey there, I'm Arduino AI Assistant`,
    description: 'Title for the legal disclaimer',
  },
  mainContent: {
    id: 'genai.legal-disclaimer-main-content',
    defaultMessage: `I’m ready to help with coding, troubleshooting, and project advice for all your Arduino boards.`,
    description: 'Main content for the legal disclaimer',
  },
  askTitle: {
    id: 'genai.legal-disclaimer-ask-title',
    defaultMessage: 'Ask me anything',
    description: 'Title for the ask a question section of the legal disclaimer',
  },
  askContent: {
    id: 'genai.legal-disclaimer-ask-content',
    defaultMessage: `From basics to advanced projects, I’ll help with all your Arduino coding needs.`,
    description:
      'Content for the ask a question section of the legal disclaimer',
  },
  privateDataTitle: {
    id: 'genai.legal-disclaimer-private-data-title',
    defaultMessage: 'Your data is private',
    description: 'Title for the private data section of the legal disclaimer',
  },
  privateDataContent: {
    id: 'genai.legal-disclaimer-private-data-content',
    defaultMessage: `Your sketches and questions remain private and won’t be used to train or enhance the AI.`,
    description: 'Content for the private data section of the legal disclaimer',
  },
  beResponsibleTitle: {
    id: 'genai.legal-disclaimer-be-responsible-title',
    defaultMessage: 'Be responsible',
    description: 'Title for the be responsible section of the legal disclaimer',
  },
  beResponsibleContent: {
    id: 'genai.legal-disclaimer-be-responsible-content',
    defaultMessage: `Arduino AI Assistant is built to provide you only with suggestions and examples. Always verify generated code for accuracy, safety and intellectual property. Avoid harmful or illegal content, and respect others’ privacy.`,
    description:
      'Content for the be responsible section of the legal disclaimer',
  },
  policyTerms: {
    id: 'genai.legal-disclaimer-policy-terms',
    defaultMessage:
      'By using the Arduino AI Assistant you accept the {privacyPolicy}.',
    description:
      'Content for the policy and terms section of the legal disclaimer',
  },
  privacyPolicy: {
    id: 'genai.legal-disclaimer-privacy-policy',
    defaultMessage: 'full policy terms',
    description: 'Content for the privacy policy link',
  },
  acceptTerms: {
    id: 'genai.legal-disclaimer-accept-terms',
    defaultMessage: 'Accept terms',
    description: 'Content for the accept terms and conditions button',
  },
});
