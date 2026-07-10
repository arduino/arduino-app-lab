import { BrickInstance } from '@cloud-editor-mono/infrastructure';

export interface BrickItemProps {
  brick: BrickInstance;
  selected?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onDelete?: () => void;
  onRename?: () => void;
  onAddBrick?: () => void;
  onDragStart?: (brick: BrickInstance) => void;
  onDragEnd?: () => void;
  missingConfig?: boolean;
}
