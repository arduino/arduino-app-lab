export type AiModelRequiredDialogLogic = () => {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDownloadModel: () => void;
  isExample: boolean;
  modelName: string;
};
