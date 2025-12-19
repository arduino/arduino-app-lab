import { ModalLogic } from '../../../essential/dialog';

export type ShareToClassroomDialogLogic = () => ReturnType<ModalLogic> & {
  handleClose: () => void;
  shareToClassroom: () => Promise<void>;
  canShareToClassroom?: boolean;
};
