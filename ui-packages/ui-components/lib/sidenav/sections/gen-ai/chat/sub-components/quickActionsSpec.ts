import { quickActionMessages } from './messages';
import {
  QuickActionItemDictionary,
  QuickActionItemIds,
  QuickActionSection,
} from './quickActions.type';

export const quickActionItems: QuickActionItemDictionary = {
  [QuickActionItemIds.GenerateSketch]: {
    id: QuickActionItemIds.GenerateSketch,
    label: quickActionMessages[QuickActionItemIds.GenerateSketch],
  },
  [QuickActionItemIds.FixErrors]: {
    id: QuickActionItemIds.FixErrors,
    label: quickActionMessages[QuickActionItemIds.FixErrors],
  },
  [QuickActionItemIds.ExplainSketch]: {
    id: QuickActionItemIds.ExplainSketch,
    label: quickActionMessages[QuickActionItemIds.ExplainSketch],
  },
};

export const quickActionSections: QuickActionSection[] = [
  // {
  //   name: 'Sketch Generation',
  //   items: [quickActionItems[QuickActionIds.GenerateSketch]],
  // },
  {
    name: 'Quick actions',
    items: [
      quickActionItems[QuickActionItemIds.FixErrors],
      quickActionItems[QuickActionItemIds.ExplainSketch],
    ],
  },
];
