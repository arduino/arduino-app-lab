import Modal from 'react-modal';

export type ModalLogic = () => {
  reactModalProps: Modal.Props;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
};
