import {
  CloudPortIcon,
  CloudPortOff,
  ConnectionLostIcon,
  UsbPort,
} from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import { memo, useRef } from 'react';

import { Button, ButtonType } from '../../../essential/button';
import { WrapperTitle } from '../../../essential/wrapper-title';
import { useI18n } from '../../../i18n/useI18n';
import { Small, TextSize, XXSmall } from '../../../typography';
import { messages } from '../../messages';
import {
  IotPortName,
  SetToolbarSelection,
  ToolbarItemIds,
} from '../../Toolbar.type';
import styles from './associated-device-button.module.scss';
import PortSwitch from './PortSwitch';

export interface AssociatedDeviceButtonProps {
  board: string;
  port?: string;
  deviceIsIot?: boolean;
  isOtaCompatible?: boolean;
  isIotToolbar?: boolean;
  isReadOnly?: boolean;
  canChangeIotDevice?: boolean;
  onClickDeviceChange?: SetToolbarSelection;
  boardsConfigIsUnknown: boolean;
  boardBubbleBadgeNumber: number;
  renderPopover?: () => JSX.Element | null;
  manyPortsAvailable?: boolean;
  connectionLost?: boolean;
  errored?: boolean;
  selectedBoardHasAltPort?: boolean;
  switchToAltPort?: () => void;
  classes?: { ['button-container']?: string; button?: string };
}

const AssociatedDeviceButton: React.FC<AssociatedDeviceButtonProps> = (
  props: AssociatedDeviceButtonProps,
) => {
  const {
    board,
    port,
    deviceIsIot,
    isOtaCompatible,
    isIotToolbar,
    isReadOnly = false,
    canChangeIotDevice = true,
    onClickDeviceChange,
    boardsConfigIsUnknown,
    boardBubbleBadgeNumber,
    manyPortsAvailable,
    connectionLost = false,
    selectedBoardHasAltPort,
    switchToAltPort,
    classes,
  } = props;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { formatMessage } = useI18n();

  const renderManualSelectionInfoNode = (): JSX.Element => (
    <div
      className={clsx(styles['manual-selection-info-tooltip'], {
        [styles['manual-selection-info-tooltip-show']]:
          boardBubbleBadgeNumber === 0,
      })}
    >
      <div className={styles['manual-selection-info-title-container']}>
        <Small bold>{formatMessage(messages.deviceNotFound)}</Small>
        <XXSmall>{formatMessage(messages.deviceNotFoundTooltip)}</XXSmall>
      </div>
      <ul className={styles['manual-selection-info-tooltip-list']}>
        <li>
          <XXSmall>{formatMessage(messages.detachDevice)}</XXSmall>
        </li>
        <li>
          <XXSmall>{formatMessage(messages.reconnectDevice)}</XXSmall>
        </li>
        <li>
          <XXSmall>{formatMessage(messages.resetDevice)}</XXSmall>
        </li>
      </ul>
    </div>
  );

  const renderUnknownSelectionInfoNode = (): JSX.Element => {
    const thirdPartyDeviceLabel = (
      <XXSmall bold>{formatMessage(messages.thirdPartyDevice)}</XXSmall>
    );
    const boardLabel = <XXSmall bold>{board}</XXSmall>;

    const boardLabelStartsWithVowel = ['a', 'e', 'i', 'o', 'u'].includes(
      board[0].toLowerCase(),
    );

    return (
      <div
        className={clsx(
          styles['unknown-selection-info-tooltip'],
          styles['unknown-selection-info-tooltip-show'],
        )}
      >
        <XXSmall>
          {formatMessage(messages.unknownDevice, {
            article: boardLabelStartsWithVowel ? 'an' : 'a',
            thirdPartyDeviceLabel,
            boardLabel,
          })}
        </XXSmall>
      </div>
    );
  };

  const renderIcon = (): JSX.Element => {
    if (!isReadOnly && selectedBoardHasAltPort && switchToAltPort)
      return (
        <PortSwitch
          onSwitch={switchToAltPort}
          selectedBoardIsIot={deviceIsIot}
        />
      );

    const ConnectionLost = (
      <ConnectionLostIcon className={styles['disconnected-icon']} />
    );

    if (connectionLost) return ConnectionLost;

    if (port)
      return deviceIsIot ? (
        port === IotPortName.Offline ? (
          ConnectionLost
        ) : isOtaCompatible ? (
          <CloudPortIcon className={styles.icon} />
        ) : (
          <CloudPortOff className={styles.icon} />
        )
      ) : (
        <UsbPort className={styles.icon} />
      );

    if (manyPortsAvailable) return <UsbPort className={styles.icon} />;

    return ConnectionLost;
  };

  const renderPortInfo = (): string | JSX.Element => {
    if (selectedBoardHasAltPort && switchToAltPort) {
      return deviceIsIot
        ? formatMessage(messages.connectedOtaPort)
        : `Port: ${port}`;
    }

    const disconnectedInfo = deviceIsIot
      ? formatMessage(messages.offlineOtaPort)
      : renderManualSelectionInfoNode();

    if (connectionLost) return disconnectedInfo;

    if (port) {
      return deviceIsIot
        ? port === IotPortName.Offline
          ? formatMessage(messages.offlineOtaPort)
          : formatMessage(messages.connectedOtaPort)
        : boardsConfigIsUnknown
        ? renderUnknownSelectionInfoNode()
        : `Port: ${port}`;
    }

    if (manyPortsAvailable) {
      return formatMessage(messages.manyDevicesFoundLabel);
    }

    return disconnectedInfo;
  };

  const portInfo = renderPortInfo();

  const renderIotDevicePopover = (): JSX.Element | null => {
    return (
      <div
        className={styles['association-node-info-popover-container']}
        role="tooltip"
      >
        <div className={clsx(styles['association-node-info-popover'])}>
          <XXSmall>{formatMessage(messages.iotSetupTabMessage)}</XXSmall>
        </div>
      </div>
    );
  };

  const renderAssociatedDeviceButton = (): JSX.Element => (
    <Button
      ref={buttonRef}
      id="association-info-button"
      type={ButtonType.Secondary}
      key={`${ToolbarItemIds.AssociationNode}-info-button`}
      size={TextSize.XSmall}
      onClick={
        !isIotToolbar && !isReadOnly
          ? (e): void => {
              buttonRef.current?.blur();
              return onClickDeviceChange && onClickDeviceChange(e);
            }
          : undefined
      }
      classes={{
        button: clsx(
          styles['text-button'],
          styles['text-button-icon'],
          styles['association-info-button-board-name'],
          isIotToolbar || isReadOnly ? styles['disable-button'] : undefined,
        ),
        textButtonText: styles['text-button-label'],
      }}
      Icon={
        isIotToolbar
          ? (): JSX.Element => (
              <WrapperTitle
                title={typeof portInfo === 'string' ? portInfo : undefined}
              >
                {renderIcon()}
              </WrapperTitle>
            )
          : renderIcon
      }
      iconPosition="left"
    >
      <Small>{board}</Small>
    </Button>
  );

  const renderBoardBubbleBadge = (): JSX.Element | null =>
    boardBubbleBadgeNumber ? (
      <div className={styles.badge}>{boardBubbleBadgeNumber}</div>
    ) : null;

  return typeof portInfo === 'string' ? (
    <WrapperTitle
      title={!isIotToolbar ? portInfo : undefined}
      id="association-node"
    >
      <div className={clsx(styles.container, classes?.['button-container'])}>
        {renderBoardBubbleBadge()}
        {renderAssociatedDeviceButton()}
        {isIotToolbar && canChangeIotDevice ? renderIotDevicePopover() : null}
      </div>
    </WrapperTitle>
  ) : (
    <div
      id="association-node"
      className={clsx(styles.container, classes?.['button-container'])}
    >
      {renderBoardBubbleBadge()}
      {renderAssociatedDeviceButton()}
      {isIotToolbar && canChangeIotDevice ? renderIotDevicePopover() : null}
      {portInfo}
    </div>
  );
};

export default memo(AssociatedDeviceButton);
