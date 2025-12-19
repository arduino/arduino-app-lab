import { Small, XSmall, XXSmall } from '../../typography';
import styles from './board-card.module.scss';

interface BoardCardProps {
  title: string;
  description?: string;
  chip: string;
  onClick?: () => void;
  ChipIcon: React.ReactNode;
  Icon: React.ReactNode;
  disabled?: boolean;
}

const BoardCard: React.FC<BoardCardProps> = (props: BoardCardProps) => {
  const { title, description, chip, onClick, ChipIcon, Icon, disabled } = props;

  return (
    <button
      className={styles['board']}
      onClick={onClick}
      disabled={disabled || !onClick}
    >
      <XXSmall uppercase className={styles['chip']}>
        {ChipIcon}
        {chip}
      </XXSmall>
      <div className={styles['icon']}>{Icon}</div>
      <Small bold uppercase className={styles['title']}>
        {title}
      </Small>
      {description ? <XSmall>{description}</XSmall> : null}
    </button>
  );
};

export default BoardCard;
