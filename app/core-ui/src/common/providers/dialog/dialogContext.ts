import { ModalLogic } from '@cloud-editor-mono/ui-components';
import { createContext } from 'react';

export type DialogContextValue<T> = ReturnType<ModalLogic> & {
  dialogInfo?: T;
  setDialogInfo: React.Dispatch<React.SetStateAction<undefined | T>>;
};

const createDialogContextValue = <T>(): DialogContextValue<T> =>
  ({} as DialogContextValue<T>);

function createDialogContext<T>(): React.Context<DialogContextValue<T>> {
  return createContext<DialogContextValue<T>>(createDialogContextValue<T>());
}

export const DialogContext = createDialogContext();
