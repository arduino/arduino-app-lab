import {
  BoardResourcesValue,
  BrickDetailModel,
  ModelDownloadInfo,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

export interface AiModelProps {
  inUseModelId?: string;
  model: BrickDetailModel;
  readOnly?: boolean;
  hideEdgeImpulse?: boolean;
  selectedModelId?: string;
  boardResourcesLogic?: () => BoardResourcesValue;
  onModelSelect?: (modelId: string) => void;
  downloadModel?: (modelId: string, impulseId: string) => Promise<void>;
  modelDownloadInfo?: ModelDownloadInfo;
  diskUsageWarning?: { used: string; total: string };
  removeModel?: (modelId: string) => Promise<void>;
  openModelPage?: (modelId: string, impulseId?: string) => void;
}
