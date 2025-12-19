import clsx from 'clsx';

import { XXSmall } from '../../typography';
import { IconButton } from '../icon-button';
import styles from './hint-label.module.scss';

interface HintLabelProps {
  label: string;
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
  onClick?: () => void;
  classes?: {
    container?: string;
    icon?: string;
  };
}

const HintLabel: React.FC<HintLabelProps> = (props: HintLabelProps) => {
  const { label, Icon, onClick, classes } = props;

  return (
    <IconButton
      onPress={onClick}
      classes={{
        button: clsx(styles['container'], classes?.container),
      }}
      label={label}
      Icon={Icon}
    >
      <XXSmall>{label}</XXSmall>
    </IconButton>
  );
};

export default HintLabel;
