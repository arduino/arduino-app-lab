import { BrickListItem } from '@cloud-editor-mono/infrastructure';
import { BrickDetailLogic } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

export interface UseBrickListLogicParams {
  brickId?: string;
  tab?: string;
}

export interface UseBrickListLogic {
  bricks: BrickListItem[];
  isLoading: boolean;
  selectedBrick: BrickListItem | null;
  brickDetailLogic: BrickDetailLogic;
  setSelectedBrick: (brick: BrickListItem | null) => void;
  selectedTab?: string;
  setSelectedTab: (tab: string) => void;
}
