import {
  BrickDetailModel,
  ModelDownloadInfo,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

export interface AiModelProps {
  inUseModelId?: string;
  model: BrickDetailModel;
  readOnly?: boolean;
  isExample?: boolean;
  selectedModelId?: string;
  onModelSelect?: (modelId: string) => void;
  downloadEIModel?: (projectId: string, impulseId: string) => Promise<void>;
  downloadGenericModel?: (modelId: string) => Promise<void>;
  modelDownloadInfo?: ModelDownloadInfo;
  isUninstalling?: (modelId: string) => boolean;
  diskUsageWarning?: { used: string; total: string };
  removeModel?: (modelId: string, isForced?: boolean) => Promise<void>;
  openModelPage?: (modelId: string, impulseId?: string) => void;
  isInstalledInApp?: boolean;
}
