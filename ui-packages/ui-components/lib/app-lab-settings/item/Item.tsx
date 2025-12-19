import clsx from 'clsx';

import { XSmall, XXSmall } from '../../typography';
import styles from './item.module.scss';

interface ItemProps {
  title?: string;
  subtitle?: string;
  isSelected?: boolean;
  Icon?: React.ReactNode;
  onClick?: () => void;
  classes?: {
    container?: string;
    content?: string;
    icon?: string;
  };
}

const Item: React.FC<ItemProps> = (props: ItemProps) => {
  const { title, subtitle, isSelected, Icon, onClick, classes } = props;

  return (
    <button
      className={clsx(styles['container'], classes?.container, {
        [styles['selected']]: isSelected,
      })}
      onClick={onClick}
    >
      <div className={clsx(styles['icon'], classes?.icon)}>{Icon}</div>
      <div className={clsx(styles['content'], classes?.content)}>
        <XSmall className={styles['title']}>{title}</XSmall>
        <XXSmall className={styles['description']}>{subtitle}</XXSmall>
      </div>
    </button>
  );
};

export default Item;
