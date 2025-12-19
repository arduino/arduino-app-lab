import { DialogContext } from './dialogContext';
import { useDialogLogic } from './dialogProvider.logic';

interface DialogProviderProps {
  children?: React.ReactNode;
}

const DialogProvider: React.FC<DialogProviderProps> = (
  props: DialogProviderProps,
) => {
  const { children } = props;

  const value = useDialogLogic();

  return (
    <DialogContext.Provider value={value}>{children}</DialogContext.Provider>
  );
};

export default DialogProvider;
