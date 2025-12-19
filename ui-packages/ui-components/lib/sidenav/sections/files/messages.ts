import { defineMessages } from 'react-intl';

import { FileMenuItemIds, NewFileMenuItemIds } from '../../sidenav.type';

export const filesMessages = defineMessages({
  searchFiles: {
    id: 'files.searchFiles',
    defaultMessage: 'Search files',
    description: 'Search files',
  },
  addFile: {
    id: 'files.addFile',
    defaultMessage: 'Add',
    description: 'Dropdown menu button content for adding a new file',
  },
});

export const newFileMenuMessages = defineMessages<
  keyof typeof NewFileMenuItemIds
>({
  [NewFileMenuItemIds.AddSketchFile]: {
    id: 'newFileMenu.addSketchFile',
    defaultMessage: 'Add Sketch File',
    description: 'Add Sketch File',
  },
  [NewFileMenuItemIds.AddHeaderFile]: {
    id: 'newFileMenu.addHeaderFile',
    defaultMessage: 'Add Header File',
    description: 'Add Header File',
  },
  [NewFileMenuItemIds.AddTextFile]: {
    id: 'newFileMenu.addTextFile',
    defaultMessage: 'Add Text File',
    description: 'Add Text File',
  },
  [NewFileMenuItemIds.AddSecretsTab]: {
    id: 'newFileMenu.addSecretsTab',
    defaultMessage: 'Add Secrets Tab',
    description: 'Add Secrets Tab',
  },
  [NewFileMenuItemIds.ImportFile]: {
    id: 'newFileMenu.importFile',
    defaultMessage: 'Import File',
    description: 'Import File',
  },
});

export const fileItemMenuMessages = defineMessages<
  keyof typeof FileMenuItemIds
>({
  [FileMenuItemIds.Rename]: {
    id: 'fileMenu.rename',
    defaultMessage: 'Rename',
    description: 'Label for rename sketch file menu item',
  },
  [FileMenuItemIds.Delete]: {
    id: 'fileMenu.delete',
    defaultMessage: 'Delete',
    description: 'Label for delete sketch file menu item',
  },
});
