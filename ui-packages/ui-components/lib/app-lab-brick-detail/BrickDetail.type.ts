import {
  BrickCreateUpdateRequest,
  BrickDetails,
  BrickInstance,
} from '@cloud-editor-mono/infrastructure';

export type BrickDetailLogic = () => {
  initialTab?: string;
  showConfigure?: boolean;
  loadBrickInstance?: (id: string) => Promise<BrickInstance>;
  loadBrickDetails: (id: string) => Promise<BrickDetails>;
  loadFileContent: (path: string) => Promise<string>;
  onOpenExternalLink?: (url: string) => void;
  updateBrickDetails?: (
    id: string,
    params: BrickCreateUpdateRequest,
  ) => Promise<boolean>;
};
