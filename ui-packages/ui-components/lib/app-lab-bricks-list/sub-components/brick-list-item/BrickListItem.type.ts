import { BrickDetails, BrickListItem } from '@cloud-editor-mono/infrastructure';

import { BrickIconProps } from '../../../app-lab-brick-icon/BrickIcon.type';

export interface AppLabBricksListItemProps {
  variant?: 'default' | 'skeleton';
  size?: BrickIconProps['size'];
  brick?: BrickListItem;
  disabledBricks?: BrickListItem[];
  selectedBrick?: BrickDetails | null;
  expanded?: boolean;
  onClick?: (brick: BrickListItem) => void;
  classes?: {
    item?: string;
    itemSelected?: string;
    itemText?: string;
    itemTitle?: string;
    itemDescription?: string;
  };
}
