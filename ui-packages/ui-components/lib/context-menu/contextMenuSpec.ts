import { UAParser } from 'ua-parser-js';

import {
  ContextMenuItemDictionary,
  ContextMenuItemIds,
  ContextMenuSectionType,
} from './contextMenu.type';
import { messages } from './messages';

const parser = new UAParser();
const shortcutCommand = parser.getOS().name === 'Windows' ? 'ctrl' : '⌘';

const contextMenuItems: ContextMenuItemDictionary = {
  [ContextMenuItemIds.Copy]: {
    id: ContextMenuItemIds.Copy,
    label: messages[ContextMenuItemIds.Copy],
    shortcut: `${shortcutCommand}C`,
  },
  [ContextMenuItemIds.Cut]: {
    id: ContextMenuItemIds.Cut,
    label: messages[ContextMenuItemIds.Cut],
    shortcut: `${shortcutCommand}X`,
  },
  [ContextMenuItemIds.Paste]: {
    id: ContextMenuItemIds.Paste,
    label: messages[ContextMenuItemIds.Paste],
    shortcut: `${shortcutCommand}V`,
  },
  [ContextMenuItemIds.Undo]: {
    id: ContextMenuItemIds.Undo,
    label: messages[ContextMenuItemIds.Undo],
    shortcut: `${shortcutCommand}Z`,
  },
  [ContextMenuItemIds.Redo]: {
    id: ContextMenuItemIds.Redo,
    label: messages[ContextMenuItemIds.Redo],
    shortcut: `${shortcutCommand}⇧Z`,
  },
  [ContextMenuItemIds.SelectAll]: {
    id: ContextMenuItemIds.SelectAll,
    label: messages[ContextMenuItemIds.SelectAll],
    shortcut: `${shortcutCommand}A`,
  },
  [ContextMenuItemIds.CommentUncomment]: {
    id: ContextMenuItemIds.CommentUncomment,
    label: messages[ContextMenuItemIds.CommentUncomment],
    shortcut: `${shortcutCommand}/`,
  },
  [ContextMenuItemIds.IncreaseIndent]: {
    id: ContextMenuItemIds.IncreaseIndent,
    label: messages[ContextMenuItemIds.IncreaseIndent],
    shortcut: 'tab',
  },
  [ContextMenuItemIds.DecreaseIndent]: {
    id: ContextMenuItemIds.DecreaseIndent,
    label: messages[ContextMenuItemIds.DecreaseIndent],
    shortcut: '⇧tab',
  },
  [ContextMenuItemIds.Find]: {
    id: ContextMenuItemIds.Find,
    label: messages[ContextMenuItemIds.Find],
    shortcut: `${shortcutCommand}F`,
  },
};

export const contextMenuSections: ContextMenuSectionType[] = [
  {
    name: 'First Group',
    items: [
      contextMenuItems.Copy,
      contextMenuItems.Cut,
      contextMenuItems.Paste,
    ],
  },
  {
    name: 'Second Group',
    items: [
      contextMenuItems.Undo,
      contextMenuItems.Redo,
      contextMenuItems.SelectAll,
    ],
  },
  {
    name: 'Third Group',
    items: [
      contextMenuItems.CommentUncomment,
      contextMenuItems.IncreaseIndent,
      contextMenuItems.DecreaseIndent,
    ],
  },
  {
    name: 'Fourth Group',
    items: [contextMenuItems.Find],
  },
];
