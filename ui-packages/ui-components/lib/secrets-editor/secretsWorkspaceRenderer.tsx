import {
  PaneContentContext,
  PaneContentRenderer,
} from '@cloud-editor-mono/ide-workbench/lib/editor-panel/paneContentRenderer';

import SecretsEditor from './SecretsEditor';
import { SecretsEditorLogic } from './secretsEditor.type';

/**
 * Pane extras contract for the secrets workspace renderer. Apps that show
 * sketch secrets pack this into `EditorPanelLogic.paneExtras.A` and pass
 * `secretsWorkspaceRenderer` through EditorPanel's `workspaceRenderers`.
 */
export interface SecretsPaneExtras {
  secretsEditorLogic?: SecretsEditorLogic;
}

const getExtras = (ctx: PaneContentContext): SecretsPaneExtras | undefined =>
  ctx.extras as SecretsPaneExtras | undefined;

/**
 * Workspace renderer for the sketch-secrets view: when the selected file
 * is the secrets pseudo-file, it replaces the whole split workspace (not
 * a single pane) with the SecretsEditor, exactly like the pre-ADR-0002
 * hard-coded early return did.
 */
export const secretsWorkspaceRenderer: PaneContentRenderer = {
  id: 'secrets-workspace',
  match: (ctx) =>
    ctx.file.ext === 'secrets' && !!getExtras(ctx)?.secretsEditorLogic,
  render: (ctx) => {
    const secretsEditorLogic = getExtras(ctx)?.secretsEditorLogic;
    if (!secretsEditorLogic) return <></>; // unreachable: match() requires it
    return <SecretsEditor secretsEditorLogic={secretsEditorLogic} />;
  },
};
