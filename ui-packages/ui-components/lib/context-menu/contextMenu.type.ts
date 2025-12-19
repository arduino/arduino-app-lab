import { MessageDescriptor } from 'react-intl';

import {
  DropdownMenuItemType,
  DropdownMenuSectionType,
} from '../essential/dropdown-menu';

export interface ClickPosition {
  clickPosX: number;
  clickPosY: number;
}

export type ContextMenuItemType = DropdownMenuItemType<
  ContextMenuItemIds,
  MessageDescriptor
>;

export type ContextMenuSectionType = DropdownMenuSectionType<
  ContextMenuItemIds,
  MessageDescriptor
>;

export enum ContextMenuItemIds {
  Cut = 'Cut',
  Copy = 'Copy',
  Paste = 'Paste',
  Undo = 'Undo',
  Redo = 'Redo',
  SelectAll = 'SelectAll',
  CommentUncomment = 'CommentUncomment',
  IncreaseIndent = 'IncreaseIndent',
  DecreaseIndent = 'DecreaseIndent',
  Find = 'Find',
}

export type ContextMenuDictionary<T> = Record<
  keyof typeof ContextMenuItemIds,
  T
>;
export type ContextMenuItemDictionary =
  ContextMenuDictionary<ContextMenuItemType>;
export type ContextMenuHandlerDictionary = ContextMenuDictionary<() => void>;
