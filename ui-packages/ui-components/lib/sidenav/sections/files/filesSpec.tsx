import {
  FileMenuItemDictionary,
  FileMenuItemIds,
  FileMenuSection,
  NewFileMenuItemDictionary,
  NewFileMenuItemIds,
} from '../../sidenav.type';
import { fileItemMenuMessages, newFileMenuMessages } from './messages';

export const newFileMenuItems: NewFileMenuItemDictionary = {
  [NewFileMenuItemIds.AddSketchFile]: {
    id: NewFileMenuItemIds.AddSketchFile,
    label: newFileMenuMessages[NewFileMenuItemIds.AddSketchFile],
    labelSuffix: <kbd>{` .ino`}</kbd>,
  },
  [NewFileMenuItemIds.AddHeaderFile]: {
    id: NewFileMenuItemIds.AddHeaderFile,
    label: newFileMenuMessages[NewFileMenuItemIds.AddHeaderFile],
    labelSuffix: <kbd>{` .h`}</kbd>,
  },
  [NewFileMenuItemIds.AddTextFile]: {
    id: NewFileMenuItemIds.AddTextFile,
    label: newFileMenuMessages[NewFileMenuItemIds.AddTextFile],
    labelSuffix: <kbd>{` .txt`}</kbd>,
  },
  [NewFileMenuItemIds.AddSecretsTab]: {
    id: NewFileMenuItemIds.AddSecretsTab,
    label: newFileMenuMessages[NewFileMenuItemIds.AddSecretsTab],
  },
  [NewFileMenuItemIds.ImportFile]: {
    id: NewFileMenuItemIds.ImportFile,
    label: newFileMenuMessages[NewFileMenuItemIds.ImportFile],
  },
};

export const newFileMenuSections: FileMenuSection[] = [
  {
    name: 'First Group',
    items: [
      newFileMenuItems.AddSketchFile,
      newFileMenuItems.AddHeaderFile,
      newFileMenuItems.AddTextFile,
      newFileMenuItems.AddSecretsTab,
    ],
  },
  {
    name: 'Second Group',
    items: [newFileMenuItems.ImportFile],
  },
];

export const fileMenuItems: FileMenuItemDictionary = {
  [FileMenuItemIds.Rename]: {
    id: FileMenuItemIds.Rename,
    label: fileItemMenuMessages[FileMenuItemIds.Rename],
  },
  [FileMenuItemIds.Delete]: {
    id: FileMenuItemIds.Delete,
    label: fileItemMenuMessages[FileMenuItemIds.Delete],
  },
};

export const fileMenuSections: FileMenuSection[] = [
  {
    name: 'First Group',
    items: [fileMenuItems.Rename],
  },
  {
    name: 'Second Group',
    items: [fileMenuItems.Delete],
  },
];
