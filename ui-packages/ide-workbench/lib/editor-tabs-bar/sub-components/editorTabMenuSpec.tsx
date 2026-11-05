import {
  NewTabMenuItemDictionary,
  NewTabMenuItemIds,
  TabMenuItemDictionary,
  TabMenuItemIds,
  TabMenuSection,
} from '../EditorTabsBar.type';
import { commandMessages, newTabCommandMessages } from './messages';

const tabMenuItems: TabMenuItemDictionary = {
  [TabMenuItemIds.Close]: {
    id: TabMenuItemIds.Close,
    label: commandMessages[TabMenuItemIds.Close],
  },
  [TabMenuItemIds.CloseOthers]: {
    id: TabMenuItemIds.CloseOthers,
    label: commandMessages[TabMenuItemIds.CloseOthers],
  },
  [TabMenuItemIds.CloseToTheLeft]: {
    id: TabMenuItemIds.CloseToTheLeft,
    label: commandMessages[TabMenuItemIds.CloseToTheLeft],
  },
  [TabMenuItemIds.CloseToTheRight]: {
    id: TabMenuItemIds.CloseToTheRight,
    label: commandMessages[TabMenuItemIds.CloseToTheRight],
  },
  [TabMenuItemIds.CloseAll]: {
    id: TabMenuItemIds.CloseAll,
    label: commandMessages[TabMenuItemIds.CloseAll],
  },
  [TabMenuItemIds.SplitRight]: {
    id: TabMenuItemIds.SplitRight,
    label: commandMessages[TabMenuItemIds.SplitRight],
  },
  [TabMenuItemIds.SplitLeft]: {
    id: TabMenuItemIds.SplitLeft,
    label: commandMessages[TabMenuItemIds.SplitLeft],
  },
  [TabMenuItemIds.RenameFile]: {
    id: TabMenuItemIds.RenameFile,
    label: commandMessages[TabMenuItemIds.RenameFile],
  },
  [TabMenuItemIds.DeleteFile]: {
    id: TabMenuItemIds.DeleteFile,
    label: commandMessages[TabMenuItemIds.DeleteFile],
  },
};

const newTabMenuItems: NewTabMenuItemDictionary = {
  [NewTabMenuItemIds.AddSketchFile]: {
    id: NewTabMenuItemIds.AddSketchFile,
    label: newTabCommandMessages[NewTabMenuItemIds.AddSketchFile],
    labelSuffix: <kbd>{` .ino`}</kbd>,
  },
  [NewTabMenuItemIds.AddHeaderFile]: {
    id: NewTabMenuItemIds.AddHeaderFile,
    label: newTabCommandMessages[NewTabMenuItemIds.AddHeaderFile],
    labelSuffix: <kbd>{` .h`}</kbd>,
  },
  [NewTabMenuItemIds.AddTextFile]: {
    id: NewTabMenuItemIds.AddTextFile,
    label: newTabCommandMessages[NewTabMenuItemIds.AddTextFile],
    labelSuffix: <kbd>{` .txt`}</kbd>,
  },
  [NewTabMenuItemIds.AddSecretsTab]: {
    id: NewTabMenuItemIds.AddSecretsTab,
    label: newTabCommandMessages[NewTabMenuItemIds.AddSecretsTab],
  },
  [NewTabMenuItemIds.ImportFile]: {
    id: NewTabMenuItemIds.ImportFile,
    label: newTabCommandMessages[NewTabMenuItemIds.ImportFile],
  },
};

export const tabMenuSections: TabMenuSection[] = [
  // Section `name` values below are internal grouping labels only; they are
  // not displayed in the rendered context menu (which only renders item
  // labels) so they intentionally bypass i18n. If a future design surfaces
  // these as visible headings they MUST be migrated to `defineMessages`.
  {
    name: 'First Group',
    items: [
      tabMenuItems.Close,
      tabMenuItems.CloseOthers,
      tabMenuItems.CloseToTheLeft,
      tabMenuItems.CloseToTheRight,
      tabMenuItems.CloseAll,
    ],
  },
  {
    name: 'Split Group',
    items: [tabMenuItems.SplitRight, tabMenuItems.SplitLeft],
  },
  {
    name: 'Second Group',
    items: [tabMenuItems.RenameFile, tabMenuItems.DeleteFile],
  },
];

export const newTabMenuSections: TabMenuSection[] = [
  {
    name: 'First Group',
    items: [
      newTabMenuItems.AddSketchFile,
      newTabMenuItems.AddHeaderFile,
      newTabMenuItems.AddTextFile,
      newTabMenuItems.AddSecretsTab,
    ],
  },
  {
    name: 'Second Group',
    items: [newTabMenuItems.ImportFile],
  },
];
