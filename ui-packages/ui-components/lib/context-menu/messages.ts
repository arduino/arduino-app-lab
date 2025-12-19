import { defineMessages } from 'react-intl';

import { ContextMenuItemIds } from './contextMenu.type';

export const messages = defineMessages<keyof typeof ContextMenuItemIds>({
  [ContextMenuItemIds.Copy]: {
    id: 'contextMenu.copy',
    defaultMessage: 'Copy',
    description: 'Copy',
  },
  [ContextMenuItemIds.Cut]: {
    id: 'contextMenu.cut',
    defaultMessage: 'Cut',
    description: 'Cut',
  },
  [ContextMenuItemIds.Paste]: {
    id: 'contextMenu.paste',
    defaultMessage: 'Paste',
    description: 'Paste',
  },
  [ContextMenuItemIds.Undo]: {
    id: 'contextMenu.undo',
    defaultMessage: 'Undo',
    description: 'Undo',
  },
  [ContextMenuItemIds.Redo]: {
    id: 'contextMenu.redo',
    defaultMessage: 'Redo',
    description: 'Redo',
  },
  [ContextMenuItemIds.SelectAll]: {
    id: 'contextMenu.selectAll',
    defaultMessage: 'Select All',
    description: 'Select All',
  },
  [ContextMenuItemIds.CommentUncomment]: {
    id: 'contextMenu.commentUncomment',
    defaultMessage: 'Comment / Uncomment',
    description: 'Comment / Uncomment',
  },
  [ContextMenuItemIds.IncreaseIndent]: {
    id: 'contextMenu.increaseIndent',
    defaultMessage: 'Increase Indent',
    description: 'Increase Indent',
  },
  [ContextMenuItemIds.DecreaseIndent]: {
    id: 'contextMenu.decreaseIndent',
    defaultMessage: 'Decrease Indent',
    description: 'Decrease Indent',
  },
  [ContextMenuItemIds.Find]: {
    id: 'contextMenu.find',
    defaultMessage: 'Find',
    description: 'Find',
  },
});
