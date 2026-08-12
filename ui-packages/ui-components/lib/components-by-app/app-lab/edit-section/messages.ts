import { defineMessages } from 'react-intl';

export const messages = defineMessages({
  sidebarCollapse: {
    id: 'app-files-section.sidebar-collapse',
    defaultMessage: 'Collapse',
    description: 'Label sidebar toggle button',
  },
  sidebarExpand: {
    id: 'app-files-section.sidebar-expand',
    defaultMessage: 'Expand',
    description: 'Label sidebar toggle button',
  },
  bricksLabel: {
    id: 'app-files-section.bricks-label',
    defaultMessage: 'Bricks',
    description: 'Label for the Bricks section in the App Files Section',
  },
  sketchLibrariesLabel: {
    id: 'app-files-section.sketch-libraries-label',
    defaultMessage: 'Sketch Libraries',
    description:
      'Label for the Sketch Libraries section in the App Files Section',
  },
  filesLabel: {
    id: 'app-files-section.files-label',
    defaultMessage: 'Files',
    description: 'Label for the Files section in the App Files Section',
  },
  addBrickButton: {
    id: 'app-files-section.add-brick-button',
    defaultMessage: 'Add Brick',
    description: 'Button text to add a new brick to the app',
  },
  addSketchLibraryButton: {
    id: 'app-files-section.add-sketch-library-button',
    defaultMessage: 'Add Sketch Library',
    description: 'Button text to add a new sketch library to the app',
  },
  addFileButton: {
    id: 'app-files-section.add-file-button',
    defaultMessage: 'Add File',
    description: 'Button text to add a new file to the app',
  },
  noBricksAddedYet: {
    id: 'app-files-section.no-bricks-added-yet',
    defaultMessage: 'No bricks added yet',
    description: 'Message shown when there are no bricks added to the app',
  },
  noSketchLibrariesAddedYet: {
    id: 'app-files-section.no-sketch-libraries-added-yet',
    defaultMessage: 'No sketch libraries added yet',
    description:
      'Message shown when there are no sketch libraries added to the app',
  },
  exampleReadonly: {
    id: 'app-files-section.example-readonly',
    defaultMessage: "Items can't be added in examples",
    description: 'Message shown on disabled action buttons for examples',
  },
  lspBannerWaitingTitle: {
    id: 'app-files-section.lsp-banner-waiting-title',
    defaultMessage: 'Installing advanced language support',
    description:
      'Title of the banner shown when LSP is not available for the current app',
  },
  lspBannerWaitingDescription: {
    id: 'app-files-section.lsp-banner-waiting-description',
    defaultMessage: 'This may take a few minutes.',
    description:
      'Description of the banner shown when LSP is not available for the current app',
  },
});
