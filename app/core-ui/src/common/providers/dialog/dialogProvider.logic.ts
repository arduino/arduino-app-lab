import { useContext, useState } from 'react';

import { DialogContext, DialogContextValue } from './dialogContext';

export type UseDialog<T> = () => DialogContextValue<T>;

export function useDialogLogic<T>(): DialogContextValue<T> {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [dialogInfo, setDialogInfo] = useState<T | undefined>(undefined);

  return {
    reactModalProps: {
      isOpen,
    },
    setIsOpen,
    setDialogInfo,
    dialogInfo,
  };
}

export const useDialog = <T>(): DialogContextValue<T> =>
  useContext(DialogContext) as DialogContextValue<T>;
