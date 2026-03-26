import {
  AIModel,
  AIModelItem,
  EIProject,
} from '@cloud-editor-mono/infrastructure';
import { ModelDownloadInfo } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { createContext, useContext } from 'react';

export type EdgeImpulseModelsContextValue = {
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
};

const EdgeImpulseModelsContextValue: EdgeImpulseModelsContextValue =
  {} as EdgeImpulseModelsContextValue;

export const EdgeImpulseModelsContext =
  createContext<EdgeImpulseModelsContextValue>(EdgeImpulseModelsContextValue);

export const useEdgeImpulseModels = (): EdgeImpulseModelsContextValue => {
  const context = useContext(EdgeImpulseModelsContext);

  if (!context) {
    throw new Error(
      'useEdgeImpulseModelsContext must be used within an EdgeImpulseModelsContextProvider',
    );
  }

  return context;
};
