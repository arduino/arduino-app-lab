import { BrickDetails, BrickInstance } from '@cloud-editor-mono/infrastructure';
import {
  Board,
  ConfigureAppBrickDialogLogic,
  TrainNewModelDialogLogic,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

export interface BrickDetailModelImpulse {
  id: string;
  name: string;
  isInstalled: boolean;
  installedModelId: string | undefined;
  isOutdated?: boolean;
  /**
   * Board model id for an Edge Impulse model that is already known to the
   * board and can therefore be downloaded by id through the generic,
   * login-free path (no linked Edge Impulse account required). Undefined for
   * models that must be installed from the Edge Impulse cloud.
   */
  downloadModelId?: string;
}

export interface BrickDetailModel {
  id: string;
  name: string;
  description: string;
  url?: string;
  source: string;
  isBuiltIn: boolean;
  isInstalled: boolean;
  metadata: Record<string, string>;
  edgeImpulseProps?: {
    projectId: string;
    impulses: BrickDetailModelImpulse[];
  };
}

export type BrickDetailLogic = (
  brickId: string,
  appId?: string,
) => {
  board?: Board;
  brick?: BrickDetails;
  isBrickLoading?: boolean;
  isCustomBrick?: boolean;
  brickInstance?: BrickInstance;
  readme?: string | null;
  apiDocs?: string | null;
  examples?: { content: string; path: string }[] | null;
  models?: BrickDetailModel[];
  readOnly?: boolean;
  hideEdgeImpulse?: boolean;
  isExample?: boolean;
  diskUsageWarning: (
    modelId: string,
  ) => { used: string; total: string } | undefined;
  configureDialogProps?: {
    open: boolean;
    appId: string;
    setOpen: (open: boolean) => void;
    logic: ConfigureAppBrickDialogLogic;
    onOpenExternal: (url: string) => void;
  };
  trainNewModelDialogProps?: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    logic: TrainNewModelDialogLogic;
  };
  isEdgeImpulseConnected: boolean;
  onTrainNewModelClick: () => void;
  openExternalLink: (url: string) => void;
  downloadEIModel: (projectId: string, impulseId: string) => Promise<void>;
  downloadGenericModel: (projectId: string) => Promise<void>;
  removeModel: (modelId: string, isForced?: boolean) => Promise<void>;
  openModelPage: (modelId: string, impulseId?: string) => void;
  getDownloadInfo: (modelId: string) => ModelDownloadInfo | undefined;
  modelDownloadInfo?: ModelDownloadInfo;
  updateModelInUse: (modelId: string) => Promise<void>;
  isModelUninstalling: (modelId: string) => boolean;
  isModelInstalledInApp?: (model: BrickDetailModel) => boolean;
};

export type UploadAiModelLogic = {
  onUpload: (file: File) => void;
  onError: (error: string) => void;
  openImportModelDialog: () => void;
};

export type ModelDownloadInfo = {
  impulseId: string;
  isDownloading: boolean;
  percentage?: number;
  error?: boolean;
  success?: boolean;
};
