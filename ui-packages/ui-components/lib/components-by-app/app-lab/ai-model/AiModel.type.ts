import { ModelOrigin } from '@cloud-editor-mono/infrastructure';

export const EDGE_IMPULSE_SOURCE = 'edgeimpulse';
export const HUGGING_FACE_SOURCE = 'huggingface';
export const QUALCOMM_AI_HUB_SOURCE = 'qualcomm-ai-hub';

export const HUGGING_FACE_HOST = 'huggingface.co';

export type KnownModelSource =
  | typeof EDGE_IMPULSE_SOURCE
  | typeof HUGGING_FACE_SOURCE
  | typeof QUALCOMM_AI_HUB_SOURCE;

export type ModelSource =
  | KnownModelSource
  // eslint-disable-next-line @typescript-eslint/ban-types
  | (string & {}); // to allow any provider the board's list names

export interface AiModelImpulse {
  id: string;
  name: string;
  isInstalled: boolean;
  installedModelId: string | undefined;
  isOutdated?: boolean;
  // Board model id for an Edge Impulse model the board already knows, so it
  // downloads by id with no linked Edge Impulse account.
  downloadModelId?: string;
}

export interface BrickDetailModel {
  id: string;
  name: string;
  description: string;
  source?: ModelSource;
  url?: string;
  origin?: ModelOrigin;
  isBuiltIn: boolean;
  isInstalled: boolean;
  metadata: Record<string, string>;
  size?: number;
  isPlaceholder?: boolean;
  edgeImpulseProps?: {
    projectId: string;
    impulses: AiModelImpulse[];
  };
}

export type ModelDownloadInfo = {
  isDownloading: boolean;
  percentage?: number;
  error?: boolean;
  success?: boolean;
  // Set for a user-linked download: until the model is installed no brick
  // declares it, so that brick detail is the only view that can show a row.
  linkedBrickId?: string;
  // The file in download, from the daemon's progress events.
  fileName?: string;
};

export interface AiModelProps {
  inUseModelId?: string;
  model: BrickDetailModel;
  readOnly?: boolean;
  isReadOnlyApp?: boolean;
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
