import { MessageDescriptor } from 'react-intl';

import {
  DropdownMenuItemType,
  DropdownMenuSectionType,
} from '../../../../../essential/dropdown-menu';

export enum QuickActionItemIds {
  GenerateSketch = 'Generate Sketch',
  ExplainSketch = 'Explain Sketch',
  FixErrors = 'Fix Errors',
}

export type QuickActionItem = DropdownMenuItemType<
  QuickActionItemIds,
  MessageDescriptor
>;
export type QuickActionSection = DropdownMenuSectionType<
  QuickActionItemIds,
  MessageDescriptor
>;

export type QuickActionDictionary<T> = { [K in QuickActionItemIds]: T };
export type QuickActionItemDictionary = QuickActionDictionary<QuickActionItem>;
