import { SketchSecrets } from '@cloud-editor-mono/infrastructure';

import { RbacValue } from '../rbac';
import { DeleteSecretDialogData } from './sub-components/delete-secret-dialog/deleteSecretDialog.type';

export type SecretsEditorLogic = () => {
  secrets?: SketchSecrets;
  rbac?: RbacValue;
  updateSecrets: (secrets?: SketchSecrets) => Promise<void>;
  openDeleteSecretDialog: (data: DeleteSecretDialogData) => void;
};
