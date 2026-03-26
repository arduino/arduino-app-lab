import { BrickInstance } from '@cloud-editor-mono/infrastructure';

export interface BrickItemProps {
  brick: BrickInstance;
  selected?: boolean;
  onClick?: () => void;
  onDelete?: () => void;
}
