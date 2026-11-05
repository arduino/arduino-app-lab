import { Extension } from '@codemirror/state';

import { CustomLspClient } from '../../../lsp-client/lsp-client-types';
import { joinFileUri } from '../../../lsp-file-uri';
import { LspLang } from '../../../lsp-types';

interface GetLspClientExtensionParams {
  client: CustomLspClient;
  fileId: string;
  lang: LspLang;
  workspaceUri: string;
}

export const getLspClientExtension = ({
  client,
  fileId,
  lang,
  workspaceUri,
}: GetLspClientExtensionParams): Extension => {
  // In-workspace files use a workspace-relative id, so prefix the workspace
  // uri. External files (opened from go-to-definition) already carry a full
  // file:// uri as their id — don't double-prefix, or the LSP document uri
  // won't match and displayFile()'s poll never resolves.
  const fileUri = fileId.startsWith('file://')
    ? fileId
    : joinFileUri(workspaceUri, fileId);
  const clientPlugin = client.plugin(fileUri, lang);
  return clientPlugin;
};
