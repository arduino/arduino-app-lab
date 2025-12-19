import { Board, UsbPort } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';

import { UNKNOWN_BOARD_NAME } from '../../../device-association-dialog';
import { Button } from '../../../essential/button';
import { ButtonType } from '../../../essential/button/button.type';
import { useI18n } from '../../../i18n/useI18n';
import { TextSize } from '../../../typography';
import { messages } from '../../messages';
import toolbarStyles from '../../toolbar.module.scss';
import { SetToolbarSelection, ToolbarItemIds } from '../../Toolbar.type';
import AssociatedDeviceButton, {
  AssociatedDeviceButtonProps,
} from '../associated-device-button/AssociatedDeviceButton';
import styles from './chromeos-device-selection.module.scss';

type ChromeOsDeviceSelectionProps = Omit<
  AssociatedDeviceButtonProps,
  'onClickDeviceChange' | 'connectionLost' | 'boardBubbleBadgeNumber' | 'board'
> & {
  isIotSketch: boolean;
  board?: string;
  onClick: SetToolbarSelection;
};

const ChromeOsDeviceSelection: React.FC<ChromeOsDeviceSelectionProps> = (
  props: ChromeOsDeviceSelectionProps,
) => {
  const {
    board,
    port,
    deviceIsIot,
    isIotSketch,
    boardsConfigIsUnknown,
    manyPortsAvailable,
    selectedBoardHasAltPort,
    isOtaCompatible,
    switchToAltPort,
    onClick,
  } = props;
  const { formatMessage } = useI18n();

  const requestWebSerialBoardDetection = (
    ev: React.SyntheticEvent & {
      associationViaWebSerialDetection?: boolean;
    },
  ): ReturnType<SetToolbarSelection> => {
    ev.associationViaWebSerialDetection = true;
    return onClick(ev);
  };

  return (
    <div className={styles['chromeos-device-selection-container']}>
      {!isIotSketch && !board && !port && (
        <Button
          id="detect-device-button"
          type={ButtonType.Secondary}
          key="detect-device-button"
          size={TextSize.XSmall}
          Icon={UsbPort}
          iconPosition="left"
          onClick={requestWebSerialBoardDetection}
          classes={{
            button: clsx(
              toolbarStyles['toolbar-button'],
              toolbarStyles['toolbar-text-button'],
              toolbarStyles['toolbar-text-button-icon'],
            ),
            textButtonText: toolbarStyles['toolbar-text-button-label'],
          }}
        >
          {formatMessage(messages.detectDevice)}
        </Button>
      )}
      {board && (
        <AssociatedDeviceButton
          key={`${ToolbarItemIds.AssociationNode}_info`}
          board={board || UNKNOWN_BOARD_NAME}
          port={port}
          deviceIsIot={deviceIsIot}
          boardsConfigIsUnknown={boardsConfigIsUnknown}
          boardBubbleBadgeNumber={0}
          onClickDeviceChange={requestWebSerialBoardDetection}
          manyPortsAvailable={manyPortsAvailable}
          selectedBoardHasAltPort={selectedBoardHasAltPort}
          isOtaCompatible={isOtaCompatible}
          switchToAltPort={switchToAltPort}
          classes={{
            'button-container':
              toolbarStyles['associated-device-info-button-container'],
            button: toolbarStyles['associated-device-info-button'],
          }}
        />
      )}
      {!isIotSketch && (
        <Button
          id="select-device-button"
          type={ButtonType.Secondary}
          key="select-device-button"
          Icon={Board}
          iconPosition="left"
          onClick={onClick}
          classes={{
            button: clsx(
              toolbarStyles['toolbar-button'],
              toolbarStyles['toolbar-text-button'],
              toolbarStyles['toolbar-text-button-icon'],
              styles['toolbar-select-board-button'],
            ),
            textButtonText: toolbarStyles['toolbar-text-button-label'],
          }}
        >
          {''}
        </Button>
      )}
    </div>
  );
};

export default ChromeOsDeviceSelection;
