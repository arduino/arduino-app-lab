import {
  AIModel,
  AIModelItem,
  EIProject,
} from '@cloud-editor-mono/infrastructure';
import { ModelDownloadInfo } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { createContext, useContext } from 'react';

export type AiModelsContextValue = {
  projects: AIModel[];
  projectsLoading: boolean;
  currentDownloads: { [projectId: string]: ModelDownloadInfo } | null;
  installedModels: AIModelItem[];
  getInstalledModel: (
    modelId: string,
    impulseId?: string,
  ) => AIModelItem | undefined;
  getEIProjectsByBrickType: (brickType: string) => EIProject[];
  downloadImpulse: (
    projectId: string,
    impulseId: string,
  ) => Promise<AIModelItem>;
  enabledEIAutoRefresh: (enabled: boolean) => void;
  openAndAssociateToDevice: () => void;
  isModelOutdated: (modelId: string) => boolean;
  downloadAIModelSSE: (id: string, progressKey?: string) => Promise<boolean>;
};

const AiModelsContextValue: AiModelsContextValue = {} as AiModelsContextValue;

export const AiModelsContext =
  createContext<AiModelsContextValue>(AiModelsContextValue);

export const useAiModels = (): AiModelsContextValue => {
  const context = useContext(AiModelsContext);

  if (!context) {
    throw new Error(
      'useAiModels must be used within an AiModelsContextProvider',
    );
  }

  return context;
};
