import { ModalLogic } from '../dialog';

export type ConfirmActionDialogLogic = () => ReturnType<ModalLogic> & {
  confirmAction: () => void;
  cancelAction: () => void;
  isLoading?: boolean;
};
