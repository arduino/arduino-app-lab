import {
  Download,
  Settings,
  ToolbarCancelX,
  Upload,
  UploadClock,
  Verify,
} from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';

import { Button } from '../essential/button/Button';
import { ButtonType } from '../essential/button/button.type';
import { FormatMessage } from '../i18n/useI18n';
import { Text, TextSize, XSmall } from '../typography';
import { messages } from './messages';
import OpenSerialMonitorButton from './sub-components/open-serial-monitor-button';
import ShareSketchButton from './sub-components/share-sketch';
import ToolbarButton from './sub-components/ToolbarButton';
import styles from './toolbar.module.scss';
import {
  SetToolbarSelection,
  ShareSketchLogic,
  ShareToClassroomLogic,
  ToolbarBusyState,
  ToolbarCommandsState,
  ToolbarItemDictionary,
  ToolbarItemIds,
} from './Toolbar.type';

const renderVerifyButton: ToolbarItemDictionary[ToolbarItemIds.VerifyButton] = (
  formatMessage: FormatMessage,
  onClick?: (...args: any) => any, // eslint-disable-line @typescript-eslint/no-explicit-any
  busyState?: ToolbarBusyState,
  commandsState = ToolbarCommandsState.canVerifyAndUpload,
) => {
  const isDisabled =
    commandsState === ToolbarCommandsState.cannotVerify ||
    commandsState === ToolbarCommandsState.cannotVerifyOrUpload;

  return busyState !== ToolbarBusyState.Uploading &&
    busyState !== ToolbarBusyState.Creating &&
    busyState !== ToolbarBusyState.Pending ? (
    <ToolbarButton
      key={ToolbarItemIds.VerifyButton}
      onClick={onClick}
      classes={{
        button: clsx(
          styles['verify-button'],
          styles['toolbar-button-icon'],
          styles['toolbar-button'],
          {
            [styles['toolbar-button-icon-busy']]:
              busyState === ToolbarBusyState.Verifying,
            [styles['toolbar-verify-button-busy']]:
              busyState === ToolbarBusyState.Verifying,
            [styles['toolbar-button-disabled']]: isDisabled,
          },
        ),
      }}
      Icon={busyState === ToolbarBusyState.Verifying ? undefined : Verify}
      label={
        busyState === ToolbarBusyState.Verifying
          ? formatMessage(messages.verifying)
          : formatMessage(messages.verify)
      }
      disabled={isDisabled}
    >
      {busyState === ToolbarBusyState.Verifying ? (
        <>
          <XSmall className={styles['interrupt-icon-label']}>
            {formatMessage(messages.verifyingShort)}
          </XSmall>
          <ToolbarCancelX className={styles['interrupt-icon']} />
        </>
      ) : null}
    </ToolbarButton>
  ) : null;
};

const renderPendingButton: ToolbarItemDictionary[ToolbarItemIds.PendingButton] =
  (
    formatMessage: FormatMessage,
    onClick?: (...args: any) => any, // eslint-disable-line @typescript-eslint/no-explicit-any
    busyState?: ToolbarBusyState,
  ) => {
    return busyState === ToolbarBusyState.Pending ? (
      <ToolbarButton
        key={ToolbarItemIds.PendingButton}
        onClick={onClick}
        classes={{
          button: clsx(
            styles['toolbar-button'],
            styles['toolbar-button-icon-busy'],
            styles['toolbar-verify-button-busy'],
          ),
        }}
        label={formatMessage(messages.pending)}
      >
        <XSmall className={styles['interrupt-icon-label']}>
          {formatMessage(messages.pend)}
        </XSmall>
        <ToolbarCancelX className={styles['interrupt-icon']} />
      </ToolbarButton>
    ) : null;
  };

const renderCreatingButton: ToolbarItemDictionary[ToolbarItemIds.CreatingButton] =
  (formatMessage: FormatMessage, busyState?: ToolbarBusyState) => {
    return busyState === ToolbarBusyState.Creating ? (
      <ToolbarButton
        key={ToolbarItemIds.CreatingButton}
        classes={{
          button: clsx(
            styles['toolbar-button'],
            styles['toolbar-button-icon-busy'],
          ),
        }}
        label={formatMessage(messages.creating)}
      />
    ) : null;
  };

const renderUploadButton: ToolbarItemDictionary[ToolbarItemIds.UploadButton] = (
  formatMessage: FormatMessage,
  onClick?: (...args: any) => any, // eslint-disable-line @typescript-eslint/no-explicit-any
  busyState?: ToolbarBusyState,
  commandsState = ToolbarCommandsState.canVerifyAndUpload,
  renderPopover?: () => JSX.Element | null,
) => {
  if (
    busyState !== ToolbarBusyState.Verifying &&
    busyState !== ToolbarBusyState.Creating &&
    busyState !== ToolbarBusyState.Pending
  ) {
    const isDisabled =
      commandsState === ToolbarCommandsState.cannotUpload ||
      commandsState === ToolbarCommandsState.cannotVerifyOrUpload;

    const icon =
      commandsState === ToolbarCommandsState.canProgramIot
        ? UploadClock
        : busyState === ToolbarBusyState.Uploading
        ? undefined
        : Upload;
    return (
      <div
        key={`${ToolbarItemIds.UploadButton}_container`}
        className={styles['upload-button-container']}
      >
        <ToolbarButton
          key={ToolbarItemIds.UploadButton}
          onClick={
            busyState === ToolbarBusyState.Uploading ? undefined : onClick
          }
          classes={{
            button: clsx(
              styles['upload-button'],
              styles['toolbar-button-icon'],
              styles['toolbar-button'],
              {
                [styles['toolbar-button-icon-busy']]:
                  busyState === ToolbarBusyState.Uploading,
                [styles['toolbar-button-disabled']]: isDisabled,
              },
            ),
          }}
          Icon={icon}
          label={
            busyState === ToolbarBusyState.Uploading
              ? formatMessage(messages.uploading)
              : formatMessage(messages.upload)
          }
          disabled={isDisabled}
        />
        {renderPopover ? renderPopover() : null}
      </div>
    );
  } else {
    return null;
  }
};

const renderAssociationNode: ToolbarItemDictionary[ToolbarItemIds.AssociationNode] =
  (
    formatMessage: FormatMessage,
    onClick?: SetToolbarSelection,
    boardBubbleBadgeNumber?: number,
    renderPopover?: () => JSX.Element | null,
  ) => {
    return (
      <div
        id="association-node"
        className={styles['association-node-container']}
        key={ToolbarItemIds.AssociationNode}
      >
        {boardBubbleBadgeNumber ? (
          <div className={styles.badge}>{boardBubbleBadgeNumber}</div>
        ) : null}
        <Button
          id="association-node-button"
          type={ButtonType.Secondary}
          key={`${ToolbarItemIds.AssociationNode}-button`}
          size={TextSize.XSmall}
          onClick={onClick}
          classes={{
            button: clsx(
              styles['toolbar-button'],
              styles['toolbar-text-button'],
              styles['toolbar-text-button-icon'],
            ),
            textButtonText: styles['toolbar-text-button-label'],
          }}
        >
          {formatMessage(messages.associateDevice)}
        </Button>
        {renderPopover ? renderPopover() : null}
      </div>
    );
  };

const renderNoAssociatedIotDevice: ToolbarItemDictionary[ToolbarItemIds.AssociationNode] =
  (formatMessage: FormatMessage) => {
    return (
      <Text
        key={`${ToolbarItemIds.AssociationNode}-text`}
        className={styles['toolbar-text']}
      >
        {formatMessage(messages.noAssociatedDevice)}
      </Text>
    );
  };

const renderOpenSerialMonitorButtonNode: ToolbarItemDictionary[ToolbarItemIds.OpenSerialMonitor] =
  (
    onClick?: (...args: any) => any, // eslint-disable-line @typescript-eslint/no-explicit-any
  ) => (
    <OpenSerialMonitorButton
      key={`${ToolbarItemIds.OpenSerialMonitor}_info`}
      onClick={onClick}
      serialMonitorIsBusy={false}
      disabled
    />
  );

export const flavourButtonId = `${ToolbarItemIds.OpenFlavourConfig}_button`;
const renderOpenFlavourConfigButton: ToolbarItemDictionary[ToolbarItemIds.OpenFlavourConfig] =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (formatMessage: FormatMessage, onClick?: (...args: any) => any) => {
    return (
      <ToolbarButton
        Icon={Settings}
        id={flavourButtonId}
        key={flavourButtonId}
        onClick={onClick}
        label={formatMessage(messages.flavourConfig)}
        classes={{
          button: clsx(
            styles['toolbar-button'],
            styles['toolbar-flavour-button'],
          ),
        }}
      />
    );
  };

const renderShareSketchButton: ToolbarItemDictionary[ToolbarItemIds.ShareSketch] =
  (
    shareSketchLogic: ShareSketchLogic,
    shareToClassroomLogic: ShareToClassroomLogic,
  ) => {
    return (
      <ShareSketchButton
        key={ToolbarItemIds.ShareSketch}
        shareSketchLogic={shareSketchLogic}
        shareToClassroomLogic={shareToClassroomLogic}
      />
    );
  };

const renderDownloadSketchButton: ToolbarItemDictionary[ToolbarItemIds.DownloadSketch] =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (formatMessage: FormatMessage, onClick?: (...args: any) => any) => {
    return (
      <ToolbarButton
        Icon={Download}
        key={`${ToolbarItemIds.DownloadSketch}_button`}
        onClick={onClick}
        label={formatMessage(messages.downloadSketch)}
        classes={{
          button: clsx(
            styles['toolbar-button'],
            styles['toolbar-flavour-button'],
          ),
        }}
      />
    );
  };

export const staticDefaultItems: ToolbarItemDictionary = {
  [ToolbarItemIds.VerifyButton]: renderVerifyButton,
  [ToolbarItemIds.UploadButton]: renderUploadButton,
  [ToolbarItemIds.PendingButton]: renderPendingButton,
  [ToolbarItemIds.CreatingButton]: renderCreatingButton,
  [ToolbarItemIds.AssociationNode]: renderAssociationNode,
  [ToolbarItemIds.OpenFlavourConfig]: renderOpenFlavourConfigButton,
  [ToolbarItemIds.OpenSerialMonitor]: renderOpenSerialMonitorButtonNode,
  [ToolbarItemIds.ShareSketch]: renderShareSketchButton,
  [ToolbarItemIds.DownloadSketch]: () => null,
};

export const staticIotItems: ToolbarItemDictionary = {
  ...staticDefaultItems,
  [ToolbarItemIds.AssociationNode]: renderNoAssociatedIotDevice,
  [ToolbarItemIds.ShareSketch]: () => null,
  [ToolbarItemIds.DownloadSketch]: renderDownloadSketchButton,
};
