import { SketchSecrets } from '@cloud-editor-mono/infrastructure';

import { DeleteSecretDialogData } from './sub-components/delete-secret-dialog/deleteSecretDialog.type';

export type SecretsEditorLogic = () => {
  secrets?: SketchSecrets;
  updateSecrets: (secrets?: SketchSecrets) => Promise<void>;
  openDeleteSecretDialog: (data: DeleteSecretDialogData) => void;
};
