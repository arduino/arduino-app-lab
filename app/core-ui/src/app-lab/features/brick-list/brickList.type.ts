import { BrickListItem } from '@cloud-editor-mono/infrastructure';
import { BrickDetailLogic } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

export interface UseBrickListLogic {
  bricks: BrickListItem[];
  isLoading: boolean;
  selectedBrick: BrickListItem | null;
  brickDetailLogic: BrickDetailLogic;
  setSelectedBrick: (brick: BrickListItem | null) => void;
}
