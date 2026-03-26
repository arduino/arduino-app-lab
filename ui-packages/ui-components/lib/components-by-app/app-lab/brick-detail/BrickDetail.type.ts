import { BrickDetails, BrickInstance } from '@cloud-editor-mono/infrastructure';
import {
  ConfigureAppBrickDialogLogic,
  TrainNewModelDialogLogic,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

export interface BrickDetailModelImpulse {
  id: string;
  name: string;
  isInstalled: boolean;
  installedModelId: string | undefined;
  isOutdated?: boolean;
}

export interface BrickDetailModel {
  id: string;
  name: string;
  description: string;
  url?: string;
  source: string;
  isBuiltIn: boolean;
  edgeImpulseProps?: {
    projectId: string;
    impulses: BrickDetailModelImpulse[];
  };
}

export type BrickDetailLogic = (
  brickId: string,
  appId?: string,
) => {
  brick?: BrickDetails;
  brickInstance?: BrickInstance;
  readme?: string | null;
  apiDocs?: string | null;
  examples?: { content: string; path: string }[] | null;
  models?: BrickDetailModel[];
  readOnly?: boolean;
  hideEdgeImpulse?: boolean;
  diskUsageWarning?: { used: string; total: string };
  configureDialogProps?: {
    open: boolean;
    appId: string;
    setOpen: (open: boolean) => void;
    logic: ConfigureAppBrickDialogLogic;
  };
  trainNewModelDialogProps?: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    logic: TrainNewModelDialogLogic;
  };
  isEdgeImpulseConnected: boolean;
  onTrainNewModelClick: () => void;
  openExternalLink: (url: string) => void;
  downloadModel: (projectId: string, impulseId: string) => Promise<void>;
  removeModel: (modelId: string) => Promise<void>;
  openModelPage: (modelId: string, impulseId?: string) => void;
  getDownloadInfo: (modelId: string) => ModelDownloadInfo | undefined;
  updateModelInUse: (modelId: string) => Promise<void>;
};

export type ModelDownloadInfo = {
  impulseId: string;
  isDownloading: boolean;
  error?: boolean;
  success?: boolean;
};
