import { BrickListItem } from '@cloud-editor-mono/infrastructure';
import clsx from 'clsx';

import styles from './bricks-list.module.scss';
import { AppLabBrickListItem } from './sub-components/brick-list-item/BrickListItem';
import { AppLabBricksListItemProps } from './sub-components/brick-list-item/BrickListItem.type';

interface BricksListProps
  extends Omit<AppLabBricksListItemProps, 'brick' | 'classes' | 'size'> {
  bricks: BrickListItem[];
  brickSize?: AppLabBricksListItemProps['size'];
  classes?: AppLabBricksListItemProps['classes'] & {
    container?: string;
  };
}

const BricksList: React.FC<BricksListProps> = (props: BricksListProps) => {
  const { bricks, brickSize, classes } = props;

  return (
    <div className={clsx(styles['container'], classes?.container)}>
      {bricks.map((brick) => (
        <AppLabBrickListItem
          {...props}
          key={brick.id}
          brick={brick}
          size={brickSize}
          classes={classes}
        />
      ))}
    </div>
  );
};

export default BricksList;
