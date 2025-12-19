import {
  AttentionExclamation,
  ConnectionLostIcon,
  InfoIconI,
  Spinner,
  UsbPort,
} from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';

import { useI18n } from '../../../i18n/useI18n';
import { Small, Text, TextSize, XXSmall } from '../../../typography';
import { messages } from '../../messages';
import { SetToolbarSelection } from '../../Toolbar.type';
import BoardBubble from '../board-bubble/BoardBubble';
import styles from './associated-device-info.module.scss';

interface AssociatedDeviceInfoProps {
  board?: string;
  port?: string;
  onClickDeviceChange?: SetToolbarSelection;
  deviceChangeButtonPosition?: 'left' | 'right';
  boardsConfigIsUnknown: boolean;
  extended?: boolean;
  uploading?: boolean;
  boardBubbleBadgeNumber: number;
  renderPopover?: () => JSX.Element | null;
  manyPortsAvailable?: boolean;
  connectionLost?: boolean;
  errored?: boolean;
  classes?: { ['button-container']?: string; button?: string };
}

const AssociatedDeviceInfo: React.FC<AssociatedDeviceInfoProps> = (
  props: AssociatedDeviceInfoProps,
) => {
  const {
    board,
    port,
    onClickDeviceChange,
    deviceChangeButtonPosition = 'right',
    boardsConfigIsUnknown,
    extended,
    uploading,
    boardBubbleBadgeNumber,
    renderPopover,
    manyPortsAvailable,
    connectionLost = false,
    errored = false,
    classes,
  } = props;
  const { formatMessage } = useI18n();

  const renderManualSelectionInfoNode = (): JSX.Element => (
    <div className={styles['manual-selection-info-container']}>
      <div className={styles['manual-selection-info-icon-container']}>
        <InfoIconI />
      </div>
      <div
        className={clsx(
          styles['manual-selection-info-tooltip'],
          styles['manual-selection-info-tooltip-show'],
        )}
      >
        {formatMessage(messages.deviceNotFoundTooltip)}
        <ul className={styles['manual-selection-info-tooltip-list']}>
          <li>{formatMessage(messages.detachDevice)}</li>
          <li>{formatMessage(messages.reconnectDevice)}</li>
          <li>{formatMessage(messages.resetDevice)}</li>
        </ul>
      </div>
    </div>
  );

  const renderUnknownSelectionInfoNode = (): JSX.Element => {
    const thirdPartyDeviceLabel = (
      <Text size={TextSize.XXSmall} bold>
        {formatMessage(messages.thirdPartyDevice)}
      </Text>
    );
    const boardLabel = (
      <Text size={TextSize.XXSmall} bold>
        {board}
      </Text>
    );

    return (
      <div className={styles['unknown-selection-info-container']}>
        <div className={styles['unknown-selection-info-icon-container']}>
          <AttentionExclamation />
        </div>
        <div
          className={clsx(
            styles['unknown-selection-info-tooltip'],
            styles['unknown-selection-info-tooltip-show'],
          )}
        >
          {formatMessage(messages.unknownDevice, {
            thirdPartyDeviceLabel,
            boardLabel,
          })}
        </div>
      </div>
    );
  };

  const renderChangeDeviceButton = (): JSX.Element | null => {
    return onClickDeviceChange ? (
      <div className={clsx(classes?.['button-container'])}>
        <BoardBubble
          onClick={onClickDeviceChange}
          classes={{
            button: clsx(
              styles['associated-device-link-button'],
              classes?.button,
            ),
          }}
          badgeValue={boardBubbleBadgeNumber}
        />
        {renderPopover && renderPopover()}
      </div>
    ) : null;
  };

  const onKeyUp = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (onClickDeviceChange && event.key == 'Enter') {
      onClickDeviceChange();
    }
  };

  const renderPortText = (): JSX.Element => {
    if (uploading) return <>{formatMessage(messages.uploading)}</>;

    const Disconnected = (
      <>
        {!extended ? <ConnectionLostIcon /> : null}
        {renderManualSelectionInfoNode()}
      </>
    );

    if (connectionLost) return Disconnected;

    if (port) {
      return (
        <>
          {!extended ? <UsbPort /> : null}
          {`Port: ${port}`}
          {boardsConfigIsUnknown ? renderUnknownSelectionInfoNode() : null}
        </>
      );
    }

    if (manyPortsAvailable) {
      return (
        <>
          <UsbPort />
          {formatMessage(messages.manyDevicesFoundLabel)}
        </>
      );
    }

    return Disconnected;
  };

  return (
    <div id="association-node" className={styles.container}>
      {deviceChangeButtonPosition === 'left'
        ? renderChangeDeviceButton()
        : null}
      {extended &&
        (uploading ? (
          <div className={styles['spinner']}>
            <Spinner />
          </div>
        ) : errored ? (
          <AttentionExclamation />
        ) : connectionLost ? (
          <ConnectionLostIcon />
        ) : (
          <UsbPort />
        ))}
      <div
        className={styles['associated-device-info']}
        onClick={onClickDeviceChange}
        role="button"
        tabIndex={0}
        onKeyUp={onKeyUp}
      >
        {board ? (
          <div
            className={clsx(
              styles['associated-device-board'],
              extended && styles['associated-device-board-no-padding'],
            )}
          >
            <Small>{board}</Small>
          </div>
        ) : null}
        {
          <XXSmall className={styles['associated-device-port-text']}>
            {renderPortText()}
          </XXSmall>
        }
      </div>
      {deviceChangeButtonPosition === 'right' ? (
        <>
          <div
            className={extended ? styles['small-divider'] : styles.divider}
          />
          {renderChangeDeviceButton()}
        </>
      ) : null}
    </div>
  );
};

export default AssociatedDeviceInfo;
