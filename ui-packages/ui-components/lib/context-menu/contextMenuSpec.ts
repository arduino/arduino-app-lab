import { getShortcutCommand } from '../common/utils';
import {
  ContextMenuItemDictionary,
  ContextMenuItemIds,
  ContextMenuSectionIds,
  ContextMenuSectionType,
} from './contextMenu.type';
import { messages } from './messages';

const shortcutCommand = getShortcutCommand();

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
    shortcut: `${shortcutCommand}⇧+Z`,
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
    shortcut: 'Tab',
  },
  [ContextMenuItemIds.DecreaseIndent]: {
    id: ContextMenuItemIds.DecreaseIndent,
    label: messages[ContextMenuItemIds.DecreaseIndent],
    shortcut: '⇧+Tab',
  },
  [ContextMenuItemIds.Find]: {
    id: ContextMenuItemIds.Find,
    label: messages[ContextMenuItemIds.Find],
    shortcut: `${shortcutCommand}F`,
  },
  // LSP
  [ContextMenuItemIds.GoToDefinition]: {
    id: ContextMenuItemIds.GoToDefinition,
    label: messages[ContextMenuItemIds.GoToDefinition],
    shortcut: `F12`,
  },
  [ContextMenuItemIds.GoToTypeDefinition]: {
    id: ContextMenuItemIds.GoToTypeDefinition,
    label: messages[ContextMenuItemIds.GoToTypeDefinition],
    shortcut: `Alt+F12`,
  },
  [ContextMenuItemIds.GoToImplementation]: {
    id: ContextMenuItemIds.GoToImplementation,
    label: messages[ContextMenuItemIds.GoToImplementation],
    shortcut: `${shortcutCommand}F12`,
  },
  [ContextMenuItemIds.FindAllReferences]: {
    id: ContextMenuItemIds.FindAllReferences,
    label: messages[ContextMenuItemIds.FindAllReferences],
    shortcut: `⇧+F12`,
  },
  [ContextMenuItemIds.Format]: {
    id: ContextMenuItemIds.Format,
    label: messages[ContextMenuItemIds.Format],
    shortcut: `⇧+Alt+F`,
  },
  [ContextMenuItemIds.Rename]: {
    id: ContextMenuItemIds.Rename,
    label: messages[ContextMenuItemIds.Rename],
    shortcut: `F2`,
  },
};

export const contextMenuSections: ContextMenuSectionType[] = [
  {
    name: ContextMenuSectionIds.Clipboard,
    items: [
      contextMenuItems.Copy,
      contextMenuItems.Cut,
      contextMenuItems.Paste,
    ],
  },
  {
    name: ContextMenuSectionIds.History,
    items: [
      contextMenuItems.Undo,
      contextMenuItems.Redo,
      contextMenuItems.SelectAll,
    ],
  },
  {
    name: ContextMenuSectionIds.Editing,
    items: [
      contextMenuItems.CommentUncomment,
      contextMenuItems.IncreaseIndent,
      contextMenuItems.DecreaseIndent,
    ],
  },
  {
    name: ContextMenuSectionIds.Search,
    items: [contextMenuItems.Find],
  },
  {
    name: ContextMenuSectionIds.LSP,
    items: [
      contextMenuItems.GoToDefinition,
      contextMenuItems.GoToTypeDefinition,
      contextMenuItems.GoToImplementation,
      contextMenuItems.FindAllReferences,
      contextMenuItems.Format,
      contextMenuItems.Rename,
    ],
  },
];
