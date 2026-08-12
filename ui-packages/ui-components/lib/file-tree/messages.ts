import { defineMessages } from 'react-intl';

export const messages = defineMessages({
  nameLabel: {
    id: 'fileTree.name',
    defaultMessage: 'Name',
    description: 'Label for the name column of the file tree',
  },
  sizeLabel: {
    id: 'fileTree.size',
    defaultMessage: 'Size',
    description: 'Label for the size column of the file tree',
  },
  modifiedAtLabel: {
    id: 'fileTree.modifiedAt',
    defaultMessage: 'Date Modified',
    description: 'Label for the date column of the file tree',
  },
  createFile: {
    id: 'fileTree.createFile',
    defaultMessage: 'Create file',
    description: 'Context menu item for creating a new file in the file tree',
  },
  createFolder: {
    id: 'fileTree.createFolder',
    defaultMessage: 'Create new folder',
    description: 'Context menu item for creating a new folder in the file tree',
  },
  importFile: {
    id: 'fileTree.importFile',
    defaultMessage: 'Import File',
    description: 'Context menu item for importing a file in the file tree',
  },
  importFolder: {
    id: 'fileTree.importFolder',
    defaultMessage: 'Import Folder',
    description: 'Context menu item for importing a folder in the file tree',
  },
  rename: {
    id: 'fileTree.rename',
    defaultMessage: 'Rename',
    description:
      'Context menu item for renaming a file or folder in the file tree',
  },
  delete: {
    id: 'fileTree.delete',
    defaultMessage: 'Delete',
    description:
      'Context menu item for deleting a file or folder in the file tree',
  },
  invalidCharactersInName: {
    id: 'fileTree.invalidCharactersInName',
    defaultMessage:
      'Invalid name. Can\'t contain $ ` / \\ < > : " | ? *, end with a dot or space.',
    description:
      'Tooltip on the file tree rename/create input when the typed name is not allowed',
  },
});
