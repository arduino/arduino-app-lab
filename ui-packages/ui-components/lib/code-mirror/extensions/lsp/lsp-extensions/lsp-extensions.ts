import { Extension } from '@codemirror/state';

import { FormatMessage } from '../../../../i18n/useI18n';
import { CustomLspClient } from '../lsp-client/lsp-client-types';
import { LspLang } from '../lsp-types';
import { getLspClientExtension } from './extensions/lsp-client/lsp-client-extension';
import { getLspClientKeymapExtension } from './extensions/lsp-client/lsp-client-keymap-extension';
import { getLspCodeActionExtension } from './extensions/lsp-code-action-extension';
import { getLspDocumentHighlightExtension } from './extensions/lsp-document-highlight-extension';
import { getLspFeedbackTooltipExtension } from './extensions/lsp-feedback-tooltip-extension';
import { getLspLinkExtension } from './extensions/lsp-link-extension';
import { getLspNavigationFeatureExtension } from './extensions/lsp-navigation-feature-extension';
import { getLspRenamePanelBlurExtension } from './extensions/lsp-rename-panel/lsp-rename-panel-blur-extension';
import { getLspRenamePanelPositionExtension } from './extensions/lsp-rename-panel/lsp-rename-panel-position-extension';
import { getLspTooltipsExtension } from './extensions/lsp-tooltip-extension';

interface GetLspExtensionsParams {
  client: CustomLspClient;
  fileId: string;
  lang: LspLang;
  workspaceUri: string;
  formatMessage: FormatMessage;
  onHoverLinkClick?: (url: string) => void;
  readOnly?: boolean;
}

export const getLspExtensions = ({
  client,
  fileId,
  lang,
  workspaceUri,
  formatMessage,
  onHoverLinkClick,
  readOnly = false,
}: GetLspExtensionsParams): Extension => {
  const extensions: Extension[] = [
    getLspClientExtension({ client, fileId, lang, workspaceUri }),
    getLspClientKeymapExtension({ formatMessage, readOnly }),
    getLspNavigationFeatureExtension({ client }),
    getLspDocumentHighlightExtension({ client }),
    getLspLinkExtension({ onHoverLinkClick }),
    getLspTooltipsExtension(),
    getLspFeedbackTooltipExtension(),
  ];

  // Content-modifying features are excluded for read-only files (external
  // files + example apps): the rename UI and code actions apply workspace edits.
  if (!readOnly) {
    extensions.push(
      getLspRenamePanelBlurExtension(),
      getLspRenamePanelPositionExtension(),
      getLspCodeActionExtension({ client, formatMessage }),
    );
  }

  return extensions;
};
