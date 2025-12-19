import { ConfirmActionDialogLogic } from '../../../essential/confirm-action-dialog';

export type DeleteFileDialogData = {
  fileId: string;
  fileFullName: string;
};

export type DeleteFileDialogLogic =
  () => ReturnType<ConfirmActionDialogLogic> & {
    fileId: string;
    fileFullName: string;
  };
