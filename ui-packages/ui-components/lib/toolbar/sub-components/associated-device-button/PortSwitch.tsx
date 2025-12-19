import { CloudPortIcon, UsbPort } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import { useRef } from 'react';
import { useButton } from 'react-aria';

import styles from './port-switch.module.scss';

interface PortSwitchProps {
  onSwitch: () => void;
  selectedBoardIsIot?: boolean;
  classes?: {
    container?: string;
    iconContainer?: string;
    iconContainerSelected?: string;
  };
}

const PortSwitch: React.FC<PortSwitchProps> = (props: PortSwitchProps) => {
  const { onSwitch, selectedBoardIsIot, classes } = props;

  const ref = useRef<HTMLDivElement>(null);
  const { buttonProps } = useButton({ onPress: onSwitch }, ref);

  return (
    <div
      data-ps-container="true"
      className={clsx(styles.container, classes?.container)}
      ref={ref}
      {...buttonProps}
    >
      <div
        className={clsx(
          styles['icon-container'],
          {
            [styles['icon-container-selected']]: !selectedBoardIsIot,
          },
          classes?.iconContainer,
          !selectedBoardIsIot && classes?.iconContainerSelected,
        )}
      >
        <UsbPort />
      </div>
      <div
        className={clsx(
          styles['icon-container'],
          {
            [styles['icon-container-selected']]: selectedBoardIsIot,
          },
          classes?.iconContainer,
          selectedBoardIsIot && classes?.iconContainerSelected,
        )}
      >
        <CloudPortIcon />
      </div>
    </div>
  );
};

export default PortSwitch;
