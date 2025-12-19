import { defineMessages } from 'react-intl';

import { QuickActionItemIds } from './quickActions.type';

export const messages = defineMessages({
  generateSketchPlaceholder: {
    id: 'sketchPlan.generateSketchPlaceholder',
    defaultMessage: 'Describe the project you would like to create',
    description: 'Placeholder for generating sketch',
  },
  placeholderSendBoxNoSketchGeneration: {
    id: 'genai.placeholder-send-box-no-sketch-generation',
    defaultMessage: `Ask a question to the Arduino AI Assistant or type '/'`,
    description:
      'Placeholder for the send box in the chat when sketch generation is disabled',
  },
  generateSketchNewFeature: {
    id: 'sketchPlan.generateSketchNewFeature',
    defaultMessage: 'New feature:',
    description: 'New feature for generating sketch',
  },
  generateSketchNewFeatureMessage: {
    id: 'sketchPlan.generateSketchNewFeatureMessage',
    defaultMessage: 'Use this feature to create a new sketch from scratch',
    description: 'Message for new feature in generating sketch',
  },
  planLimitsReached: {
    id: 'genai.plan-limits-reached',
    defaultMessage: 'Plan limits reached.',
    description: 'Plan limits reached message',
  },
  upgradeToUnlock: {
    id: 'genai.upgrade-to-unlock',
    defaultMessage: '{planLimitsReached} Upgrade to unlock more.',
    description: 'Upgrade to unlock more button',
  },
  upgradeToUnlockShorter: {
    id: 'genai.upgrade-to-unlock-shorter',
    defaultMessage: '{planLimitsReached}',
    description: 'Upgrade to unlock more button',
  },
  upgradePlan: {
    id: 'genai.upgrade-plan',
    defaultMessage: 'Upgrade plan',
    description: 'Upgrade plan button',
  },
});

export const quickActionMessages = defineMessages({
  [QuickActionItemIds.GenerateSketch]: {
    id: 'sketchPlan.generateSketchMessage',
    defaultMessage: '/generate_sketch',
    description: 'Message for generating sketch',
  },
  [QuickActionItemIds.ExplainSketch]: {
    id: 'genai.explain-sketch',
    defaultMessage: '/explain_sketch',
    description: 'Explain sketch button',
  },
  [QuickActionItemIds.FixErrors]: {
    id: 'genai.fix-errors',
    defaultMessage: '/fix_errors',
    description: 'Fix errors button',
  },
});
