export type AiModelRequiredDialogLogic = () => {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDownloadModel: () => void;
  isReadOnlyApp: boolean;
  modelName: string;
};
