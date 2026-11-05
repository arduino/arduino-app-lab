import {
  AppBrickDetails,
  BrickDetails,
} from '@cloud-editor-mono/infrastructure';

import { AddHuggingFaceModelDialogProps } from '../../../dialogs/app-lab/add-hugging-face-model-dialog/AddHuggingFaceModelDialog';
import { ConfigureAppBrickDialogLogic } from '../../../dialogs/app-lab/configure-app-brick-dialog/ConfigureAppBrickDialog';
import { TrainNewModelDialogProps } from '../../../dialogs/app-lab/train-new-model-dialog/TrainNewModelDialog';
import { BrickDetailModel, ModelDownloadInfo } from '../ai-model/AiModel.type';
import { BrickExample } from './sub-components/tabs/examples-tab/ExamplesTab.type';

const BRICK_DETAIL_TAB_IDS = [
  'overview',
  'examples',
  'documentation',
  'aiModels',
] as const;

export type BrickDetailTabId = typeof BRICK_DETAIL_TAB_IDS[number];

export const isBrickDetailTabId = (value: unknown): value is BrickDetailTabId =>
  typeof value === 'string' &&
  (BRICK_DETAIL_TAB_IDS as readonly string[]).includes(value);

interface ConfigureBrickDialogProps {
  open: boolean;
  appId: string;
  setOpen: (open: boolean) => void;
  logic: ConfigureAppBrickDialogLogic;
  onOpenExternal: (url: string) => void;
}

export type BrickDetailLogic = (
  brickId: string,
  onModelInstalled?: (modelId: string) => void,
) => {
  brick?: BrickDetails;
  isBrickLoading: boolean;
  isCustomBrick: boolean;
  brickInstance?: AppBrickDetails;
  readme?: string | null;
  apiDocs?: string | null;
  examples?: BrickExample[] | null;
  models: BrickDetailModel[];
  readOnly: boolean;
  trainNewModelEnabled: boolean;
  addHuggingFaceModelEnabled: boolean;
  isReadOnlyApp: boolean;
  diskUsageWarning: (
    modelId: string,
  ) => { used: string; total: string } | undefined;
  configureDialogProps?: ConfigureBrickDialogProps;
  trainNewModelDialogProps?: TrainNewModelDialogProps;
  onTrainNewModelClick: () => void;
  openExternalLink: (url: string) => void;
  downloadEIModel: (projectId: string, impulseId: string) => Promise<void>;
  downloadGenericModel: (modelId: string) => Promise<void>;
  removeModel: (modelId: string, isForced?: boolean) => Promise<void>;
  openModelPage: (modelId: string, impulseId?: string) => void;
  getDownloadInfo: (modelId: string) => ModelDownloadInfo | undefined;
  updateModelInUse: (modelId: string) => Promise<void>;
  isModelUninstalling: (modelId: string) => boolean;
  isModelInstalledInApp: (model: BrickDetailModel) => boolean;
  addHuggingFaceModelDialogProps?: AddHuggingFaceModelDialogProps;
};
