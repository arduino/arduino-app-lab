import { ConfirmActionDialogLogic } from '../../../essential/confirm-action-dialog';

export interface DeleteSecretDialogData {
  secretName: string;
  onConfirm: () => void;
}

export type DeleteSecretDialogLogic = ConfirmActionDialogLogic;
