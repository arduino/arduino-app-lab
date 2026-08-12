import { defineMessages } from 'react-intl';

export const messages = defineMessages({
  languageServerStarting: {
    id: 'lsp.languageServerStarting',
    defaultMessage: 'Language server is starting…',
    description:
      'Feedback tooltip shown when an LSP action is triggered before the language server has finished starting',
  },
  findReferencesNotSupported: {
    id: 'lsp.findReferencesNotSupported',
    defaultMessage: 'Find all references not supported',
    description:
      'Feedback tooltip when the LSP server does not support find-all-references',
  },
  noReferencesFound: {
    id: 'lsp.noReferencesFound',
    defaultMessage: 'No references found',
    description:
      'Feedback tooltip when the LSP server finds no references at the cursor',
  },
  goToDefinitionNotSupported: {
    id: 'lsp.goToDefinitionNotSupported',
    defaultMessage: 'Go to definition not supported',
    description:
      'Feedback tooltip when the LSP server does not support go-to-definition',
  },
  noDefinitionFound: {
    id: 'lsp.noDefinitionFound',
    defaultMessage: 'No definition found',
    description:
      'Feedback tooltip when the LSP server finds no definition at the cursor',
  },
  goToTypeDefinitionNotSupported: {
    id: 'lsp.goToTypeDefinitionNotSupported',
    defaultMessage: 'Go to type definition not supported',
    description:
      'Feedback tooltip when the LSP server does not support go-to-type-definition',
  },
  noTypeDefinitionFound: {
    id: 'lsp.noTypeDefinitionFound',
    defaultMessage: 'No type definition found',
    description:
      'Feedback tooltip when the LSP server finds no type definition at the cursor',
  },
  goToImplementationNotSupported: {
    id: 'lsp.goToImplementationNotSupported',
    defaultMessage: 'Go to implementation not supported',
    description:
      'Feedback tooltip when the LSP server does not support go-to-implementation',
  },
  noImplementationFound: {
    id: 'lsp.noImplementationFound',
    defaultMessage: 'No implementation found',
    description:
      'Feedback tooltip when the LSP server finds no implementation at the cursor',
  },
  renameNotSupported: {
    id: 'lsp.renameNotSupported',
    defaultMessage: 'Rename not supported',
    description: 'Feedback tooltip when the LSP server does not support rename',
  },
  placeCursorOnSymbolToRename: {
    id: 'lsp.placeCursorOnSymbolToRename',
    defaultMessage: 'Place cursor on a symbol to rename',
    description:
      'Feedback tooltip shown when the user tries to rename but cursor is not on a symbol',
  },
  renameNewNameLabel: {
    id: 'lsp.renameNewNameLabel',
    defaultMessage: 'New name',
    description: 'Accessible label of the rename panel input',
  },
  renameHint: {
    id: 'lsp.renameHint',
    defaultMessage: 'Enter to rename',
    description:
      'Hint shown under the rename panel input, explaining how to confirm the rename',
  },
  renameNameRequired: {
    id: 'lsp.renameNameRequired',
    defaultMessage: 'Enter a new name',
    description:
      'Validation error shown in the rename panel when the new name is empty',
  },
  renameNameInvalid: {
    id: 'lsp.renameNameInvalid',
    defaultMessage: '“{name}” is not a valid name',
    description:
      'Validation error shown in the rename panel when the new name is not a valid identifier for the language',
  },
  renameFailed: {
    id: 'lsp.renameFailed',
    defaultMessage: 'Could not rename symbol',
    description:
      'Feedback tooltip when the LSP server rejects a rename or returns no edits',
  },
  renamedOtherFiles: {
    id: 'lsp.renamedOtherFiles',
    defaultMessage:
      'Renamed in this file and {count, plural, one {# other file} other {# other files}}',
    description:
      'Feedback tooltip after a cross-file rename, reporting how many files other than the open one were updated. They are edited in place and not opened, so this is the only signal that they changed.',
  },
  renamePartiallyApplied: {
    id: 'lsp.renamePartiallyApplied',
    defaultMessage: 'Renamed, but some files could not be updated',
    description:
      'Feedback tooltip when a rename was applied to some files but not all of them',
  },
  formatNotSupported: {
    id: 'lsp.formatNotSupported',
    defaultMessage: 'Format not supported',
    description:
      'Feedback tooltip when the LSP server does not support document formatting',
  },
  formatRangeNotSupported: {
    id: 'lsp.formatRangeNotSupported',
    defaultMessage: 'Format selection not supported',
    description:
      'Feedback tooltip when the LSP server does not support formatting the selected range',
  },
  formatFailedFixErrors: {
    id: 'lsp.formatFailedFixErrors',
    defaultMessage: 'Could not format: fix the errors in this file first',
    description:
      'Feedback tooltip when the LSP server returns no formatting edits for a file that has errors, e.g. a Python syntax error, which the formatter cannot parse',
  },
  codeActionsAvailable: {
    id: 'lsp.codeActionsAvailable',
    defaultMessage: 'Code actions available ({modKey}.)',
    description:
      'Tooltip on the lightbulb gutter marker indicating code actions are available',
  },
  codeActionsNotSupported: {
    id: 'lsp.codeActionsNotSupported',
    defaultMessage: 'Code actions not supported',
    description:
      'Feedback tooltip when the LSP server does not support code actions',
  },
  noCodeActionsFound: {
    id: 'lsp.noCodeActionsFound',
    defaultMessage: 'No code actions found',
    description:
      'Feedback tooltip when the LSP server finds no code actions at the cursor',
  },
});
