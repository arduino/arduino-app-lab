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
  // LSP
  [ContextMenuItemIds.GoToDefinition]: {
    id: 'contextMenu.goToDefinition',
    defaultMessage: 'Go to Definition',
    description: 'Go to Definition',
  },
  [ContextMenuItemIds.GoToTypeDefinition]: {
    id: 'contextMenu.goToTypeDefinition',
    defaultMessage: 'Go to Type Definition',
    description: 'Go to Type Definition',
  },
  [ContextMenuItemIds.GoToImplementation]: {
    id: 'contextMenu.goToImplementation',
    defaultMessage: 'Go to Implementation',
    description: 'Go to Implementation',
  },
  [ContextMenuItemIds.FindAllReferences]: {
    id: 'contextMenu.findAllReferences',
    defaultMessage: 'Find All References',
    description: 'Find All References',
  },
  [ContextMenuItemIds.Format]: {
    id: 'contextMenu.format',
    defaultMessage: 'Format',
    description: 'Format',
  },
  [ContextMenuItemIds.Rename]: {
    id: 'contextMenu.rename',
    defaultMessage: 'Rename',
    description: 'Rename',
  },
});
