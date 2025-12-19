import { ModalLogic } from '../../../essential/dialog';

export type GenAIPolicyTermsDialogLogic = () => ReturnType<ModalLogic> & {
  handleClose: () => void;
};
