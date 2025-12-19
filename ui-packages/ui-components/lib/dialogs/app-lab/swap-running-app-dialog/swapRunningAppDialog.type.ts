export type SwapRunningAppDialogLogic = () => {
  open: boolean;
  setOpen: (open: boolean) => void;
  handleSwap: () => void;
};
