export type AppLabWelcomeDialogLogic = () => {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};
