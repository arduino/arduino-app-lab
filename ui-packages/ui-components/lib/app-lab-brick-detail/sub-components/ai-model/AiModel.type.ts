import { BrickModel } from '@cloud-editor-mono/infrastructure';

export interface AppLabAiModelProps {
  inUseModelId?: string;
  model: BrickModel;
  selectedModelId?: string;
  onClick?: (modelId: string) => void;
}
